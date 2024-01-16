import {useMemo} from 'react';
import {useWallet} from '@yearn-finance/web-lib/contexts/useWallet';
import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TAddress, TToken} from '@yearn-finance/web-lib/types';

export function useToken({address, chainID}: {address: string | TAddress; chainID: number}): TToken {
	const {getToken} = useWallet();

	const balance = useMemo((): TToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address]);

	return balance;
}
