import {SummaryData} from 'app/components/common/SummaryData';
import {useOption} from 'app/contexts/useOption';
import {useVotingEscrow} from 'app/contexts/useVotingEscrow';
import {useVeYFIAPY} from 'app/hooks/useVeYFIAPY';
import {formatDateShort} from 'app/utils';
import {formatAmount, formatPercent, toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';

import type {ReactElement} from 'react';

export function HeadingData(): ReactElement {
	const {votingEscrow, positions} = useVotingEscrow();
	const {dYFIPrice} = useOption();
	const APY = useVeYFIAPY({dYFIPrice});

	const totalLockedYFI = toNormalizedValue(toBigInt(votingEscrow?.supply), 18);
	const yourLockedYFI = toNormalizedValue(toBigInt(positions?.deposit?.underlyingBalance), 18);
	return (
		<SummaryData
			items={[
				{
					label: 'Max veYFI lock vAPY',
					content: APY ? formatPercent(APY * 100) : '-'
				},
				{
					label: 'Total Locked YFI',
					content: formatAmount(totalLockedYFI, 4) ?? '-'
				},
				{
					label: 'Your Locked YFI',
					content: formatAmount(yourLockedYFI, 4) ?? '-'
				},
				{
					label: 'Expiration for the lock',
					content: positions?.unlockTime ? formatDateShort(positions.unlockTime) : '-'
				}
			]}
		/>
	);
}
