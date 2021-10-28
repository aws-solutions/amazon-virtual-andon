// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

process.env.AWS_REGION = 'mock-region-1';
process.env.RETRY_SECONDS = '0.01';
process.env.ANONYMOUS_DATA_UUID = 'mock-metrics-uuid';
process.env.SOLUTION_ID = 'mock-solution-id';
process.env.SOLUTION_VERSION = 'mock-solution-version';
process.env.SEND_ANONYMOUS_DATA = 'Yes';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'solution-helper-fn-name';
process.env.LOGGING_LEVEL = 'VERBOSE';
