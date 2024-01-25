import {useMemo} from 'react';
import {useWallet} from '@builtbymom/web3/contexts/useWallet';
import {toAddress} from '@builtbymom/web3/utils';

import type {TAddress, TToken} from '@builtbymom/web3/types';

export function useToken({address, chainID}: {address: string | TAddress; chainID: number}): TToken {
	const {getToken} = useWallet();

	const balance = useMemo((): TToken => {
		return getToken({address: toAddress(address), chainID: chainID});
	}, [getToken, address]);

	return balance;
}
