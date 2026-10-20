import {useMemo} from 'react';
import {useYearn} from 'app/contexts/useYearn';

import type {TAddress} from '@builtbymom/web3/types';

/******************************************************************************
 ** Return a current token quote from the Price Service context. Missing,
 ** failed, or stale quotes remain undefined so UI does not present zero.
 *****************************************************************************/
export function useYearnTokenPrice({address, chainID}: {address: TAddress; chainID: number}): number | undefined {
	const {prices} = useYearn();

	const tokenPrice = useMemo(
		(): number | undefined => prices?.[chainID]?.[address.toLowerCase()],
		[address, prices, chainID]
	);

	return tokenPrice;
}
