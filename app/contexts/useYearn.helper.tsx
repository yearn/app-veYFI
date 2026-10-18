import {useCallback, useMemo} from 'react';
import {useTokenList} from '@builtbymom/web3/contexts/WithTokenList';
import {useChainID} from '@builtbymom/web3/hooks/useChainID';
import {toAddress} from '@builtbymom/web3/utils';
import {getNetwork} from '@builtbymom/web3/utils/wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import {useBalances} from './useBalances.multichains';

import type {TYChainTokens} from '@yearn-finance/web-lib/types';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TDict} from '@builtbymom/web3/types';
import type {TYearnVault} from 'app/hooks/useKongYearnVaults';

function addBalanceToken(tokens: Map<string, TUseBalancesTokens>, token: TUseBalancesTokens): void {
	const address = toAddress(token.address);
	const key = `${token.chainID}/${address}`;
	const existing = tokens.get(key);
	tokens.set(key, {
		...existing,
		...token,
		address,
		name: token.name || existing?.name,
		symbol: token.symbol || existing?.symbol,
		decimals: token.decimals ?? existing?.decimals
	});
}

export function useYearnTokens({
	vaults,
	vaultsMigrations,
	vaultsRetired,
	isLoadingVaultList
}: {
	vaults: TDict<TYearnVault>;
	vaultsMigrations: TDict<TYearnVault>;
	vaultsRetired: TDict<TYearnVault>;
	isLoadingVaultList: boolean;
}): TUseBalancesTokens[] {
	const {currentNetworkTokenList} = useTokenList();
	const {safeChainID} = useChainID();

	const availableTokenListTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens = Object.values(currentNetworkTokenList).map((token): TUseBalancesTokens => ({
			address: toAddress(token.address),
			chainID: token.chainID,
			decimals: Number(token.decimals),
			name: token.name,
			symbol: token.symbol
		}));
		const {nativeCurrency} = getNetwork(safeChainID);
		if (nativeCurrency) {
			tokens.push({
				address: toAddress(ETH_TOKEN_ADDRESS),
				chainID: safeChainID,
				decimals: nativeCurrency.decimals,
				name: nativeCurrency.name,
				symbol: nativeCurrency.symbol
			});
		}
		return tokens;
	}, [safeChainID, currentNetworkTokenList]);

	return useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}

		const tokens = new Map<string, TUseBalancesTokens>();
		const extraTokens: TUseBalancesTokens[] = [
			{chainID: 1, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
			{chainID: 10, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
			{chainID: 137, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Matic', symbol: 'POL'},
			{chainID: 250, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Fantom', symbol: 'FTM'},
			{chainID: 8453, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
			{chainID: 42161, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'}
		];
		for (const token of [...availableTokenListTokens, ...extraTokens]) {
			addBalanceToken(tokens, token);
		}

		const vaultInventory = [
			...Object.values(vaults),
			...Object.values(vaultsMigrations),
			...Object.values(vaultsRetired)
		];
		for (const vault of vaultInventory) {
			addBalanceToken(tokens, {
				address: vault.address,
				chainID: vault.chainID,
				decimals: vault.decimals,
				name: vault.name,
				symbol: vault.symbol
			});

			if (vault.token?.address) {
				addBalanceToken(tokens, {
					address: vault.token.address,
					chainID: vault.chainID,
					decimals: vault.token.decimals,
					name: vault.token.name,
					symbol: vault.token.symbol
				});
			}

			if (vault.staking.available) {
				addBalanceToken(tokens, {
					address: vault.staking.address,
					chainID: vault.chainID,
					decimals: vault.decimals,
					name: vault.name,
					symbol: vault.symbol
				});
			}
		}

		return [...tokens.values()];
	}, [isLoadingVaultList, availableTokenListTokens, vaults, vaultsMigrations, vaultsRetired]);
}

export function useYearnBalances({
	vaults,
	vaultsMigrations,
	vaultsRetired,
	isLoadingVaultList
}: {
	vaults: TDict<TYearnVault>;
	vaultsMigrations: TDict<TYearnVault>;
	vaultsRetired: TDict<TYearnVault>;
	isLoadingVaultList: boolean;
}): {
	balances: TYChainTokens;
	isLoadingBalances: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const allTokens = useYearnTokens({vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList});
	const {data: tokensRaw, onUpdate, onUpdateSome, isLoading} = useBalances({tokens: allTokens});

	const balances = useDeepCompareMemo((): TYChainTokens => {
		const tokens = {...tokensRaw};
		return tokens as TYChainTokens;
	}, [tokensRaw]);

	const onRefresh = useCallback(
		async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TYChainTokens> => {
			if (tokenToUpdate) {
				const updatedBalances = await onUpdateSome(tokenToUpdate);
				return updatedBalances as TYChainTokens;
			}
			const updatedBalances = await onUpdate();
			return updatedBalances as TYChainTokens;
		},
		[onUpdate, onUpdateSome]
	);

	return {balances, isLoadingBalances: isLoading, onRefresh};
}
