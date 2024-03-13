import {useYearn} from 'app/contexts/useYearn';
import {toAddress} from '@builtbymom/web3/utils';

import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

export function useBalance({
	address,
	chainID
}: {
	address: string | TAddress;
	chainID: number;
	source?: TDict<TNormalizedBN>;
}): TNormalizedBN {
	const {getBalance} = useYearn();

	return getBalance({address: toAddress(address), chainID: chainID});
}
