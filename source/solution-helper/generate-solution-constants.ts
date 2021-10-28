// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ICustomResourceRequest } from './lib/utils';
import { v4 as uuidV4 } from 'uuid';
import { getOptions } from '../solution-utils/get-options';
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';

// Import AWS SDK
import Iot from 'aws-sdk/clients/iot';
const awsSdkOptions = getOptions();
const iot = new Iot(awsSdkOptions);

interface HandlerOutput {
    anonymousUUID?: string;
    iotEndpointAddress?: string;
}
const { LOGGING_LEVEL, AWS_LAMBDA_FUNCTION_NAME } = process.env;
const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

export async function handleGenerateSolutionConstants(event: ICustomResourceRequest): Promise<HandlerOutput> {
    if (event.RequestType === 'Create') {
        return {
            anonymousUUID: uuidV4(),
            iotEndpointAddress: await getIotEndpoint()
        };
    }

    return {};
}

/**
 * Get IoT endpoint.
 * @return {Promise<string?>} - IoT endpoint
 */
async function getIotEndpoint(): Promise<string> {
    const params = {
        endpointType: 'iot:Data-ATS'
    };

    try {
        const response = await iot.describeEndpoint(params).promise();
        return response.endpointAddress;
    } catch (error) {
        logger.log(LogLevel.ERROR, 'Error getting IoT endpoint.', error);
        throw error;
    }
}
