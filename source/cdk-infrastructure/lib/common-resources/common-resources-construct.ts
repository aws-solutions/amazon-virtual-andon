// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SolutionHelper } from './solution-helper/solution-helper-construct';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

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
    public readonly solutionHelper: SolutionHelper;

    constructor(scope: Construct, id: string, props: CommonResourcesProps) {
        super(scope, id);

        this.solutionHelper = new SolutionHelper(this, 'SolutionHelper', {
            sendAnonymousData: props.sendAnonymousData,
            solutionId: props.solutionId,
            solutionVersion: props.solutionVersion,
            solutionDisplayName: props.solutionDisplayName,
            sourceCodeBucketName: props.sourceCodeBucketName,
            sourceCodeKeyPrefix: props.sourceCodeKeyPrefix,
            loggingLevel: props.loggingLevel
        });


        NagSuppressions.addResourceSuppressions(
            this.solutionHelper,
            [
                {
                    id: "AwsSolutions-IAM5",
                    appliesTo: ["Action::s3:GetObject*"],
                    reason: "Cloudwatch logs policy needs access to all logs arns because it's creating log groups"
                }
            ],
            true
          );
    }
}
