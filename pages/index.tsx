import {SummaryData} from 'app/components/common/SummaryData';
import {Tabs} from 'app/components/common/Tabs';
import {RedeemTab} from 'app/components/RedeemTab';
import {RewardsTab} from 'app/components/RewardsTab';
import {TabManageGauges} from 'app/components/TabManageGauges';
import {TabManageVeYFI} from 'app/components/TabManageVeYFI';
import {useOption} from 'app/contexts/useOption';
import {useVotingEscrow} from 'app/contexts/useVotingEscrow';
import {useVeYFIAPY} from 'app/hooks/useVeYFIAPY';
import {formatDateShort} from 'app/utils';
import {formatAmount, formatPercent, toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';

import type {ReactElement} from 'react';

function HeadingData(): ReactElement {
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

function Index(): ReactElement {
	const tabs = [
		{id: 'gauges', label: 'Manage Gauges', content: <TabManageGauges />},
		{id: 'manage', label: 'Manage veYFI', content: <TabManageVeYFI />},
		{id: 'rewards', label: 'Claim Rewards', content: <RewardsTab />},
		{id: 'redeem', label: 'Redeem dYFI', content: <RedeemTab />}
	].filter(Boolean);

	return (
		<>
			<h1 className={'w-full text-center text-8xl font-bold'}>{'veYFI'}</h1>

			<div className={'my-14 w-full'}>
				<HeadingData />
			</div>

			<Tabs items={tabs} />
		</>
	);
}

export default Index;
