// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnResource, Resource, IAspect } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CustomResourceActions, IAndonWebsiteConfig } from '../../solution-helper/lib/utils';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { IConstruct } from 'constructs';

/**
 * The CFN NAG suppress rule interface
 * @interface CfnNagSuppressRule
 */
interface CfnNagSuppressRule {
    id: string;
    reason: string;
}

/**
 * Adds CFN NAG suppress rules to the CDK resource.
 * @param resource The CDK resource
 * @param rules The CFN NAG suppress rules
 */
export function addCfnSuppressRules(resource: Resource | CfnResource, rules: CfnNagSuppressRule[]) {
    if (resource instanceof Resource) {
        resource = resource.node.defaultChild as CfnResource;
    }

    if (resource.cfnOptions.metadata?.cfn_nag?.rules_to_suppress) {
        resource.cfnOptions.metadata.cfn_nag.rules_to_suppress.push(...rules);
    } else {
        resource.addMetadata('cfn_nag', {
            rules_to_suppress: rules
        });
    }
}

export enum IotConstants {
    ISSUES_TOPIC = 'ava/issues',
    DEVICES_TOPIC = 'ava/devices',
    GROUPS_TOPIC = 'ava/groups'
}

export interface ISetupPutWebsiteConfigCustomResourceProps {
    readonly hostingBucket: Bucket;
    readonly customResourceAction: CustomResourceActions.PUT_WEBSITE_CONFIG;
    readonly andonWebsiteConfigFileName: 'andon_config';
    readonly andonWebsiteConfig: IAndonWebsiteConfig;
}


/**
 * CDK Aspect to add common CFN Nag rule suppressions to Lambda functions
 */
export class LambdaFunctionAspect implements IAspect {
    visit(node: IConstruct): void {
        const resource = node as CfnResource;

        if (resource instanceof CfnFunction) {
            const rules = [
                { id: 'W89', reason: 'VPC for Lambda is not needed. This serverless architecture does not deploy a VPC.' },
                { id: 'W92', reason: 'ReservedConcurrentExecutions is not needed for this Lambda function.' }
            ];

            addCfnSuppressRules(resource, rules);
        }
    }
}