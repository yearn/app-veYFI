import React, {createContext, memo, useCallback, useContext, useState} from 'react';
import {VEYFI_GAUGE_ABI} from 'app/abi/veYFIGauge.abi';
import {keyBy, VE_YFI_GAUGES, VE_YFI_GAUGESV2, VEYFI_CHAIN_ID} from 'app/utils';
import {FixedNumber} from 'ethers';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {toAddress, toNormalizedBN} from '@builtbymom/web3/utils';
import {decodeAsAddress, decodeAsBigInt, decodeAsNumber, decodeAsString} from '@builtbymom/web3/utils/decoder';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {readContracts} from '@wagmi/core';

import type {ReactElement} from 'react';
import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

export type TGauge = {
	address: TAddress;
	vaultAddress: TAddress;
	name: string;
	symbol: string;
	decimals: number;
	totalStaked: TNormalizedBN;
	rewardRate: TNormalizedBN;
};

export type TGaugePosition = {
	address: TAddress;
	deposit: TNormalizedBN;
	reward: TNormalizedBN;
	boost: number;
};

export type TGaugeContext = {
	gaugesMap: TDict<TGauge | undefined>;
	userPositionInGauge: TDict<TGaugePosition | undefined>;
	refresh: () => void;
};
const defaultProps: TGaugeContext = {
	gaugesMap: {},
	userPositionInGauge: {},
	refresh: (): void => undefined
};

const GaugeContext = createContext<TGaugeContext>(defaultProps);
export const GaugeContextApp = memo(function GaugeContextApp({children}: {children: ReactElement}): ReactElement {
	const {address, isActive} = useWeb3();
	const [gauges, set_gauges] = useState<TGauge[]>([]);
	const [userPositionInGauge, set_userPositionInGauge] = useState<TDict<TGaugePosition>>({});

	const refreshVotingEscrow = useAsyncTrigger(async (): Promise<void> => {
		const gaugePromises = VE_YFI_GAUGES.map(async (gaugeAddress): Promise<TGauge> => {
			const results = await readContracts(retrieveConfig(), {
				contracts: [
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'asset'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'name'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'symbol'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'decimals'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'totalAssets'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'rewardRate'}
				]
			});
			const decimals = Number(decodeAsBigInt(results[3])) || decodeAsNumber(results[3]);
			const totalAssets = toNormalizedBN(decodeAsBigInt(results[4]), decimals);

			const rewardScale = VE_YFI_GAUGESV2.includes(toAddress(gaugeAddress)) ? 36 : 18;
			const rewardRate = toNormalizedBN(decodeAsBigInt(results[5]), rewardScale);

			return {
				address: gaugeAddress,
				vaultAddress: decodeAsAddress(results[0]),
				name: decodeAsString(results[1]),
				symbol: decodeAsString(results[2]),
				decimals: decimals,
				totalStaked: totalAssets,
				rewardRate
			};
		});

		const allGauges = await Promise.all(gaugePromises);
		set_gauges(allGauges);
	}, []);

	const refreshPositions = useAsyncTrigger(async (): Promise<void> => {
		if (!gauges || !isActive || !address) {
			return;
		}
		const positionPromises = gauges.map(async (gauge): Promise<TGaugePosition> => {
			const results = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'earned',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'nextBoostedBalanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'decimals'
					}
				]
			});

			const balance = decodeAsBigInt(results[0]);
			const earned = decodeAsBigInt(results[1]);
			const boostedBalance = decodeAsBigInt(results[2]);
			const decimals = Number(decodeAsBigInt(results[3])) || decodeAsNumber(results[3]);
			const depositPosition: TNormalizedBN = toNormalizedBN(balance, decimals);
			const rewardPosition: TNormalizedBN = toNormalizedBN(earned, decimals);

			const boostRatio =
				balance > 0n
					? FixedNumber.from(boostedBalance).divUnsafe(FixedNumber.from(balance)).toUnsafeFloat()
					: 0.1;
			const boost = Math.min(1, boostRatio) * 10;

			return {
				address: gauge.address,
				deposit: depositPosition,
				reward: rewardPosition,
				boost
			};
		});
		const allPositions = await Promise.all(positionPromises);
		const allPositionsAsMap: TDict<TGaugePosition> = {};
		for (const positions of allPositions) {
			allPositionsAsMap[positions.address] = positions;
		}

		set_userPositionInGauge(allPositionsAsMap);
	}, [address, gauges, isActive]);

	const refresh = useCallback(async (): Promise<void> => {
		refreshVotingEscrow();
		refreshPositions();
	}, [refreshPositions, refreshVotingEscrow]);

	const contextValue = useDeepCompareMemo(
		(): TGaugeContext => ({
			gaugesMap: keyBy(gauges, 'address'),
			userPositionInGauge: userPositionInGauge,
			refresh
		}),
		[gauges, userPositionInGauge, refresh]
	);

	return <GaugeContext.Provider value={contextValue}>{children}</GaugeContext.Provider>;
});

export const useGauge = (): TGaugeContext => useContext(GaugeContext);
