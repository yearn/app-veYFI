import {createContext, memo, useCallback, useContext, useEffect} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {useFetchYearnEarnedForUser} from '@yearn-finance/web-lib/hooks/useFetchYearnEarnedForUser';
import {useFetchYearnPrices} from '@yearn-finance/web-lib/hooks/useFetchYearnPrices';
import {useFetchYearnTokens} from '@yearn-finance/web-lib/hooks/useFetchYearnTokens';
import {useFetchYearnVaults} from '@yearn-finance/web-lib/hooks/useFetchYearnVaults';

import {useYearnBalances} from './useYearn.helper';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TYChainTokens, TYToken} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned} from '@yearn-finance/web-lib/utils/schemas/yDaemonEarnedSchema';
import type {TYDaemonPricesChain} from '@yearn-finance/web-lib/utils/schemas/yDaemonPricesSchema';
import type {TYDaemonTokens} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokensSchema';
import type {TYDaemonVault, TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;

type TTokenAndChain = {address: TAddress; chainID: number};
export type TYearnContext = {
	currentPartner: TAddress;
	earned?: TYDaemonEarned;
	prices?: TYDaemonPricesChain;
	tokens?: TYDaemonTokens;
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	mutateVaultList: KeyedMutator<TYDaemonVaults>;
	//
	//Yearn wallet context
	getToken: ({address, chainID}: TTokenAndChain) => TYToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	getPrice: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TYChainTokens;
	isLoading: boolean;
	onRefresh: (tokenList?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
};

const defaultToken: TYToken = {
	address: toAddress(''),
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: zeroNormalizedBN,
	balance: zeroNormalizedBN,
	supportedZaps: []
};

const YearnContext = createContext<TYearnContext>({
	currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
	earned: {
		earned: {},
		totalRealizedGainsUSD: 0,
		totalUnrealizedGainsUSD: 0
	},
	prices: {},
	tokens: {},
	vaults: {},
	vaultsMigrations: {},
	vaultsRetired: {},
	isLoadingVaultList: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mutateVaultList: (): any => undefined,
	//
	//Yearn wallet context
	getToken: (): TYToken => defaultToken,
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	getPrice: (): TNormalizedBN => zeroNormalizedBN,
	balances: {},
	isLoading: true,
	onRefresh: async (): Promise<TYChainTokens> => ({})
});

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress} = useWeb3();
	const prices = useFetchYearnPrices();
	const tokens = useFetchYearnTokens();
	const earned = useFetchYearnEarnedForUser();
	const {vaults, vaultsMigrations, vaultsRetired, isLoading, mutate} = useFetchYearnVaults();
	const {tokens: balances, isLoading: isLoadingBalances, onRefresh} = useYearnBalances();

	useEffect(() => {
		const tokensToRefresh: TUseBalancesTokens[] = [];
		for (const [chainID, tokensData] of Object.entries(tokens)) {
			if (tokensData) {
				for (const [address, token] of Object.entries(tokensData)) {
					if (token) {
						tokensToRefresh.push({address: toAddress(address), chainID: Number(chainID)});
					}
				}
			}
		}

		onRefresh(tokensToRefresh);
	}, [tokens, onRefresh]);

	const getToken = useCallback(
		({address, chainID}: TTokenAndChain): TYToken => balances?.[chainID || 1]?.[address] || defaultToken,
		[balances]
	);
	const getBalance = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			if (isZeroAddress(userAddress)) {
				return zeroNormalizedBN;
			}
			return balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN;
		},
		[balances, userAddress]
	);

	const getPrice = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			const price = balances?.[chainID || 1]?.[address]?.price;
			if (!price) {
				return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN;
			}
			return price;
		},
		[prices, balances]
	);

	return (
		<YearnContext.Provider
			value={{
				currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
				prices,
				tokens,
				earned,
				vaults,
				vaultsMigrations,
				vaultsRetired,
				isLoadingVaultList: isLoading,
				mutateVaultList: mutate,
				getToken,
				getBalance,
				getPrice,
				balances: balances,
				isLoading: isLoadingBalances || false,
				onRefresh
			}}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
