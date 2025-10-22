import {useVotingEscrow} from 'app/contexts/useVotingEscrow';
import {MAX_LOCK_TIME} from 'app/utils';
import {toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {getTimeUntil, toWeeks} from '@yearn-finance/web-lib/utils/time';

import {ClaimVeYFI} from './ViewClaimVeYFI';
import {EarlyExitVeYFI} from './ViewEarlyExitVeYFI';
import {ExtendLockVeYFI} from './ViewExtendLockVeYFI';
import {LockVeYFI} from './ViewLockVeYFI';
import {ModifyLockVeYFI} from './ViewModifyLockVeYFI';

import type {ReactElement} from 'react';

export function TabManageVeYFI(): ReactElement {
	const {positions} = useVotingEscrow();
	const lockData = toNormalizedBN(toBigInt(positions?.deposit?.underlyingBalance), 18);
	const hasLock = lockData && toBigInt(lockData.raw) > 0n;
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions.unlockTime) : 0;
	const remainingWeeks = timeUntilUnlock ? toWeeks(timeUntilUnlock, false) : 0;
	const modifyThresholdWeeks = MAX_LOCK_TIME - 1;
	const shouldShowModify = hasLock && remainingWeeks > modifyThresholdWeeks;

	return (
		<div className={'grid gap-10'}>
			<LockVeYFI />
			<div className={hasLock ? 'grid gap-10' : 'grid gap-10 opacity-40'}>
				<div className={'h-px w-full bg-neutral-300'} />
				{shouldShowModify ? <ModifyLockVeYFI /> : <ExtendLockVeYFI />}
				<div className={'h-px w-full bg-neutral-300'} />
				<EarlyExitVeYFI />
				<div className={'h-px w-full bg-neutral-300'} />
				<ClaimVeYFI />
			</div>
		</div>
	);
}
