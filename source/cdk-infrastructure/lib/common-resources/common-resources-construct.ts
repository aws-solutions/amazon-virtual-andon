// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, RemovalPolicy } from '@aws-cdk/core';
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption } from '@aws-cdk/aws-s3';
import { SolutionHelper } from './solution-helper/solution-helper-construct';
import { addCfnSuppressRules } from '../../utils/utils';

export interface CommonResourcesProps {
    readonly defaultLanguage: string;
    readonly sendAnonymousData: string;
    readonly solutionId: string;
    readonly solutionVersion: string;
    readonly solutionDisplayName: string;
    readonly sourceCodeBucketName: string;
    readonly sourceCodeKeyPrefix: string;
    readonly loggingLevel: string;
}

/**
 * Construct that creates Common Resources for the solution. A logging S3 bucket will be created along
 * with a SolutionHelper construct
 */
export class CommonResources extends Construct {
    public readonly logsBucket: Bucket;
    public readonly solutionHelper: SolutionHelper;

    constructor(scope: Construct, id: string, props: CommonResourcesProps) {
        super(scope, id);

        this.logsBucket = new Bucket(this, 'LogBucket', {
            accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.S3_MANAGED,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        addCfnSuppressRules(this.logsBucket, [
            { id: 'W35', reason: 'This bucket is to store S3 and CloudFront logs, so it does not require to have logs for this bucket.' },
            { id: 'W51', reason: 'This bucket is to store S3 and CloudFront logs, so it does not require a bucket policy.' }
        ]);

        this.solutionHelper = new SolutionHelper(this, 'SolutionHelper', {
            sendAnonymousData: props.sendAnonymousData,
            solutionId: props.solutionId,
            solutionVersion: props.solutionVersion,
            solutionDisplayName: props.solutionDisplayName,
            sourceCodeBucketName: props.sourceCodeBucketName,
            sourceCodeKeyPrefix: props.sourceCodeKeyPrefix,
            loggingLevel: props.loggingLevel
        });
    }
}
