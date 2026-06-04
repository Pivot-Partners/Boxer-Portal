'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export function useSalaryThreshold() {
	const [multiplier, setMultiplier] = useState(4);
	const [pct, setPct] = useState(25);

	useEffect(() => {
		api<{ data: { salary_threshold_pct: number } }>('/m1/config')
			.then((r) => {
				const p = r.data?.salary_threshold_pct;
				if (p && p > 0) {
					setPct(p);
					setMultiplier(100 / p);
				}
			})
			.catch(() => {});
	}, []);

	return { multiplier, pct };
}
