import {useMemo} from 'react';
import {useYearn} from 'app/contexts/useYearn';
import {toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';

import type {TAddress} from '@builtbymom/web3/types';

/******************************************************************************
 ** The useYearnTokenPrice hook is used to retrieve the price of a token from
 ** the useYearn context. The price is returned as a normalizedValue with a
 ** fallback of 0.
 *****************************************************************************/
export function useYearnTokenPrice({address, chainID}: {address: TAddress; chainID: number}): number {
	const {prices} = useYearn();

	const tokenPrice = useMemo(
		(): number => toNormalizedValue(toBigInt(prices?.[chainID]?.[address] || 0), 6),
		[address, prices, chainID]
	);

	return tokenPrice;
}
