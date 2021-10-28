// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios, { AxiosRequestConfig } from 'axios';
import moment from 'moment';

const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';
export const METRICS_ENDPOINT_PAGE = 'https://metrics.awssolutionsbuilder.com/page';
const { ANONYMOUS_DATA_UUID, SOLUTION_ID, SOLUTION_VERSION } = process.env;

interface IMetricPayload {
    Solution: string;
    Version: string;
    UUID: string;
    TimeStamp: string;
    Data: any;
}

export async function sendAnonymousMetric(data: any): Promise<void> {
    try {
        const payload: IMetricPayload = {
            Solution: SOLUTION_ID,
            Version: SOLUTION_VERSION,
            UUID: ANONYMOUS_DATA_UUID,
            TimeStamp: moment.utc().format('YYYY-MM-DD HH:mm:ss.S'),
            Data: data
        };

        validatePayload(payload);
        const payloadStr = JSON.stringify(payload);

        const config: AxiosRequestConfig = {
            headers: {
                'content-type': '',
                'content-length': payloadStr.length
            }
        };

        console.log('Sending anonymous metric', payloadStr);
        const response = await axios.post(METRICS_ENDPOINT, payloadStr, config);
        console.log(`Anonymous metric response: ${response.statusText} (${response.status})`);
    } catch (err) {
        // Log the error
        console.error('Error sending anonymous metric');
        console.error(err);
    }
}

export function validatePayload(payload: IMetricPayload): void {
    if (!payload.Solution || payload.Solution.trim() === '') { throw new Error('Solution ID was not supplied'); }
    if (!payload.Version || payload.Version.trim() === '') { throw new Error('Solution version was not supplied'); }
    if (!payload.TimeStamp || payload.TimeStamp.trim() === '') { throw new Error('TimeStamp was not supplied'); }
    if (!payload.UUID || payload.UUID.trim() === '') { throw new Error('Anonymous UUID was not supplied'); }
    if (typeof payload.Data !== 'object') { throw new Error('Data was not an object'); }
    if (payload.Data === null) { throw new Error('Data was not supplied'); }
    if (Object.keys(payload.Data).length === 0) { throw new Error('Data was an empty object'); }
}
