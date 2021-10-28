// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, RemovalPolicy, Stack, ArnFormat, Duration } from '@aws-cdk/core';
import { GraphqlApi, Schema, AuthorizationType, FieldLogLevel, UserPoolDefaultAction, MappingTemplate, DynamoDbDataSource, AppsyncFunction, Resolver, BaseResolverProps } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, BillingMode, TableEncryption, ProjectionType, CfnTable } from '@aws-cdk/aws-dynamodb';
import { Role, ServicePrincipal, PolicyStatement, PolicyDocument, Effect } from '@aws-cdk/aws-iam';
import { UserPool } from '@aws-cdk/aws-cognito';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';

export interface AppSyncApiProps {
  readonly solutionDisplayName: string;
  readonly solutionVersion: string;
  readonly sourceCodeBucketName: string;
  readonly sourceCodeKeyPrefix: string;
  readonly loggingLevel: string;
  readonly userPool: UserPool;
  readonly issueNotificationTopicArn: string;
}

/**
 * Construct that creates resources (DynamoDB tables, resolvers, functions, etc.) for the AppSync API. 
 */
export class AppSyncApi extends Construct {
  public readonly graphqlApi: GraphqlApi;
  public readonly issuesTable: Table;
  public readonly dataHierarchyTable: Table;

  constructor(scope: Construct, id: string, props: AppSyncApiProps) {
    super(scope, id);

    const sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);

    this.issuesTable = this.createTable(AVATableLogicalIds.ISSUES_TABLE);
    this.dataHierarchyTable = this.createTable(AVATableLogicalIds.DATA_HIERARCHY_TABLE);

    const logRole = new Role(this, 'LogRole', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
      path: '/'
    });

    logRole.addToPrincipalPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
    }));

    this.graphqlApi = new GraphqlApi(this, 'GraphqlApi', {
      name: 'ava-api',
      schema: Schema.fromAsset(`${__dirname}/schema.graphql`),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool,
            defaultAction: UserPoolDefaultAction.ALLOW
          }
        },
        additionalAuthorizationModes: [{
          authorizationType: AuthorizationType.IAM
        }]
      },
      logConfig: { fieldLogLevel: FieldLogLevel.NONE, excludeVerboseContent: false, role: logRole }
    });

    const issuesDataSource = this.graphqlApi.addDynamoDbDataSource('IssueDataSource', this.issuesTable);
    const dataHierarchyDataSource = this.graphqlApi.addDynamoDbDataSource('AVADataSource', this.dataHierarchyTable);
    const noneDataSource = this.graphqlApi.addNoneDataSource('NoneDataSource');

    const avaResolverLambdaFnRole = new Role(this, 'AppSyncResolverLambdaFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        'SnsPolicy': new PolicyDocument({
          statements: [new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sns:Subscribe', 'sns:Unsubscribe', 'sns:SetSubscriptionAttributes'],
            resources: [props.issueNotificationTopicArn]
          })]
        }),
        'DynamoDbPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
              resources: [this.dataHierarchyTable.tableArn]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [`${this.issuesTable.tableArn}/index/ByCreatedDate-index`]
            })
          ]
        }),
        'CloudWatchLogsPolicy': new PolicyDocument({
          statements: [new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '/aws/lambda/*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
          })]
        })
      }
    });

    const avaResolverLambdaFn = new LambdaFunction(this, 'AppSyncResolverLambdaFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'appsync-lambda-resolver/index.handler',
      timeout: Duration.seconds(60),
      description: `${props.solutionDisplayName} (${props.solutionVersion}): Resolver for various AppSync functions`,
      code: Code.fromBucket(sourceCodeBucket, [props.sourceCodeKeyPrefix, 'appsync-lambda-resolver.zip'].join('/')),
      role: avaResolverLambdaFnRole,
      environment: {
        LOGGING_LEVEL: props.loggingLevel,
        ISSUE_NOTIFICATION_TOPIC_ARN: props.issueNotificationTopicArn,
        DATA_HIERARCHY_TABLE_NAME: this.dataHierarchyTable.tableName,
        ISSUES_TABLE_NAME: this.issuesTable.tableName
      }
    });

    const avaLambdaDataSource = this.graphqlApi.addLambdaDataSource('AVALambdaDataSource', avaResolverLambdaFn);

    const appsyncFunctions = {
      getPermissionsForAssociateGroupUserFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'GetPermissionsForAssociateGroupUserFunction', description: 'Get permissions for an associate group user', reqTemplateStr: 'Query.get.req.vtl' }),
      listSitesFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListSitesFunction', description: 'Get sites', reqTemplateStr: 'Query.listSites.req.vtl' }),
      createRootCauseFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateRootCauseFunction', description: 'Create a root cause', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listRootCausesByNameFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListRootCausesByNameFunction', description: 'Get root causes', reqTemplateStr: 'Query.listRootCausesByName.req.vtl' }),
      listSitesByNameFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListSitesByNameFunction', description: 'Get sites by name', reqTemplateStr: 'Query.listSitesByName.req.vtl' }),
      createSiteFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateSiteFunction', description: 'Create a site', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listAreasFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListAreasFunction', description: 'Get areas', reqTemplateStr: 'Query.listAreas.req.vtl' }),
      createAreaFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateAreaFunction', description: 'Create an area', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listStationsFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListStationsFunction', description: 'Get stations', reqTemplateStr: 'Query.listStations.req.vtl' }),
      createStationFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateStationFunction', description: 'Create a station', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listProcessesFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListProcessesFunction', description: 'Get processes', reqTemplateStr: 'Query.listProcesses.req.vtl' }),
      createProcessFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateProcessFunction', description: 'Create a process', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listDevicesFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListDevicesFunction', description: 'Get devices', reqTemplateStr: 'Query.listDevices.req.vtl' }),
      createDeviceFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateDeviceFunction', description: 'Create a device', reqTemplateStr: 'Mutation.create.req.vtl' }),
      listEventsFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'ListEventsFunction', description: 'Get events', reqTemplateStr: 'Query.listEvents.req.vtl' }),
      createEventFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'CreateEventFunction', description: 'Create an event', reqTemplateStr: 'Mutation.create.req.vtl' }),
      updateEventFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'UpdateEventFunction', description: 'Update an event', reqTemplateStr: 'Mutation.updateEvent.req.vtl' }),
      deleteEventFunction: this.getFunction({ dataSource: dataHierarchyDataSource, name: 'DeleteEventFunction', description: 'Delete an event', reqTemplateStr: 'Mutation.delete.req.vtl' }),
      handleEventSnsFunction: avaLambdaDataSource.createFunction({ name: 'HandleEventSnsFunction', description: 'Manages SNS Subscriptions to the main AVA Topic' }),
      listIssuesByDeviceFunction: this.getFunction({ dataSource: issuesDataSource, name: 'ListIssuesByDeviceFunction', description: 'Get issues by device', reqTemplateStr: 'Query.issuesByDevice.req.vtl' })
    };

    this.getResolver({ typeName: 'Site', fieldName: 'area', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Site.area.req.vtl' });
    this.getResolver({ typeName: 'Area', fieldName: 'site', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Area.site.req.vtl' });
    this.getResolver({ typeName: 'Area', fieldName: 'process', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Area.process.req.vtl' });
    this.getResolver({ typeName: 'Area', fieldName: 'station', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Area.station.req.vtl' });
    this.getResolver({ typeName: 'Process', fieldName: 'area', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Process.area.req.vtl' });
    this.getResolver({ typeName: 'Process', fieldName: 'event', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Process.event.req.vtl' });
    this.getResolver({ typeName: 'Event', fieldName: 'process', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Event.process.req.vtl' });
    this.getResolver({ typeName: 'Station', fieldName: 'area', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Station.area.req.vtl' });
    this.getResolver({ typeName: 'Station', fieldName: 'device', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Station.device.req.vtl' });
    this.getResolver({ typeName: 'Device', fieldName: 'station', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Device.station.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getSite', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listSites',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listSitesFunction],
      reqTemplateStr: `
        $util.qr($ctx.stash.put("permissionCheck", true))
        $util.qr($ctx.stash.put("type", "site"))
        {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createSite',
      pipelineFunctions: [appsyncFunctions.listSitesByNameFunction, appsyncFunctions.createSiteFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteSite', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getArea', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listAreas',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listAreasFunction],
      reqTemplateStr: `
        $util.qr($ctx.stash.put("permissionCheck", true))
        $util.qr($ctx.stash.put("type", "area"))
        {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createArea',
      pipelineFunctions: [appsyncFunctions.listAreasFunction, appsyncFunctions.createAreaFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteArea', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getStation', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listStations',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listStationsFunction],
      reqTemplateStr: `
        $util.qr($ctx.stash.put("permissionCheck", true))
        $util.qr($ctx.stash.put("type", "station"))
        {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createStation',
      pipelineFunctions: [appsyncFunctions.listStationsFunction, appsyncFunctions.createStationFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteStation', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getProcess', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listProcesses',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listProcessesFunction],
      reqTemplateStr: `
      $util.qr($ctx.stash.put("permissionCheck", true))
      $util.qr($ctx.stash.put("type", "process"))
      {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createProcess',
      pipelineFunctions: [appsyncFunctions.listProcessesFunction, appsyncFunctions.createProcessFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteProcess', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listDevices',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listDevicesFunction],
      reqTemplateStr: `
      $util.qr($ctx.stash.put("permissionCheck", true))
      $util.qr($ctx.stash.put("type", "device"))
      {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createDevice',
      pipelineFunctions: [appsyncFunctions.listDevicesFunction, appsyncFunctions.createDeviceFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteDevice', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getEvent', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'listEvents',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listEventsFunction],
      reqTemplateStr: `
        $util.qr($ctx.stash.put("permissionCheck", true))
        $util.qr($ctx.stash.put("type", "event"))
        {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createEvent',
      pipelineFunctions: [appsyncFunctions.listEventsFunction, appsyncFunctions.createEventFunction, appsyncFunctions.handleEventSnsFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'updateEvent',
      pipelineFunctions: [appsyncFunctions.updateEventFunction, appsyncFunctions.handleEventSnsFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'deleteEvent',
      pipelineFunctions: [appsyncFunctions.deleteEventFunction, appsyncFunctions.handleEventSnsFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'createIssue', dataSource: issuesDataSource, reqTemplateStr: 'Mutation.createIssue.req.vtl' });
    this.getResolver({ typeName: 'Mutation', fieldName: 'updateIssue', dataSource: issuesDataSource, reqTemplateStr: 'Mutation.updateIssue.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'issuesBySiteAreaStatus', dataSource: issuesDataSource, reqTemplateStr: 'Query.issuesBySiteAreaStatus.req.vtl' });
    this.getResolver({
      typeName: 'Query',
      fieldName: 'issuesByDevice',
      pipelineFunctions: [appsyncFunctions.getPermissionsForAssociateGroupUserFunction, appsyncFunctions.listIssuesByDeviceFunction],
      reqTemplateStr: `
      $util.qr($ctx.stash.put("permissionCheck", true))
      $util.qr($ctx.stash.put("type", "issue"))
      {}`.trim(),
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'putPermission', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.putPermission.req.vtl' });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deletePermission', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'getPermission', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.get.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'listPermissions', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.listPermissions.req.vtl' });
    this.getResolver({ typeName: 'Query', fieldName: 'listRootCauses', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Query.listRootCauses.req.vtl' });
    this.getResolver({
      typeName: 'Mutation',
      fieldName: 'createRootCause',
      pipelineFunctions: [appsyncFunctions.listRootCausesByNameFunction, appsyncFunctions.createRootCauseFunction],
      reqTemplateStr: '{}',
      resTemplateStr: 'Response.prev.vtl'
    });
    this.getResolver({ typeName: 'Mutation', fieldName: 'deleteRootCause', dataSource: dataHierarchyDataSource, reqTemplateStr: 'Mutation.delete.req.vtl' });
    avaLambdaDataSource.createResolver({ typeName: 'Query', fieldName: 'getPrevDayIssuesStats' });

    // Create subscriptions
    ['onCreateIssue', 'onUpdateIssue', 'onPutPermission', 'onDeletePermission', 'onCreateRootCause', 'onDeleteRootCause'].forEach(fieldName => {
      this.graphqlApi.createResolver({
        typeName: 'Subscription',
        dataSource: noneDataSource,
        fieldName,
        requestMappingTemplate: MappingTemplate.fromString(`
        {
          "version": "2018-05-29",
          "payload": {}
        }`),
        responseMappingTemplate: MappingTemplate.fromFile(`${__dirname}/resolver/Subscription.res.vtl`)
      });
    });
  }

  /**
   * Creates Table and Global Secondary Index for the supplied tableId
   * @param tableId ID for the table in this construct
   * @returns Table object
   */
  private createTable(tableId: string): Table {
    const table: Table = new Table(this, tableId, {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      sortKey: tableId === AVATableLogicalIds.DATA_HIERARCHY_TABLE ? { name: 'type', type: AttributeType.STRING } : undefined,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: tableId === AVATableLogicalIds.ISSUES_TABLE ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true
    });

    // Add Global Secondary Index
    switch (tableId) {
      case AVATableLogicalIds.ISSUES_TABLE:
        table.addGlobalSecondaryIndex({
          indexName: 'ByDevice-index',
          partitionKey: { name: 'siteName', type: AttributeType.STRING },
          sortKey: { name: 'areaName#status#processName#stationName#deviceName#created', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });

        table.addGlobalSecondaryIndex({
          indexName: 'BySiteAreaStatus-index',
          partitionKey: { name: 'siteName', type: AttributeType.STRING },
          sortKey: { name: 'areaName#status#processName#eventDescription#stationName#deviceName#created', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });

        table.addGlobalSecondaryIndex({
          indexName: 'ByDeviceEvent-index',
          partitionKey: { name: 'deviceName#eventId', type: AttributeType.STRING },
          sortKey: { name: 'id', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });

        table.addGlobalSecondaryIndex({
          indexName: 'ByCreatedDate-index',
          partitionKey: { name: 'createdDateUtc', type: AttributeType.STRING },
          sortKey: { name: 'createdAt', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });
        break;
      case AVATableLogicalIds.DATA_HIERARCHY_TABLE:
        table.addGlobalSecondaryIndex({
          indexName: 'ByTypeAndParent-index',
          partitionKey: { name: 'type', type: AttributeType.STRING },
          sortKey: { name: 'parentId', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });

        table.addGlobalSecondaryIndex({
          indexName: 'ByTypeAndName-index',
          partitionKey: { name: 'type', type: AttributeType.STRING },
          sortKey: { name: 'name', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL
        });
        break;
    }

    // Override the logical ID of the table to ensure the 
    // resource can be moved within the CDK project
    (table.node.defaultChild as CfnTable).overrideLogicalId(tableId);

    return table;
  }

  /**
   * Creates an AppSync Resolver based on the supplied properties
   * @param props IGetResolverProps: properties for creating the resolver
   * @returns Resolver object
   */
  private getResolver(props: IGetResolverProps): Resolver {
    let requestTemplate = MappingTemplate.fromString(props.reqTemplateStr);
    if (props.reqTemplateStr.endsWith('.vtl')) {
      requestTemplate = MappingTemplate.fromFile(`${__dirname}/resolver/${props.reqTemplateStr}`);
    }

    let responseTemplate = MappingTemplate.fromFile(`${__dirname}/resolver/Response.vtl`);
    if (props.resTemplateStr) {
      responseTemplate = MappingTemplate.fromFile(`${__dirname}/resolver/${props.resTemplateStr}`);
    }

    const createResolverProps: BaseResolverProps = {
      typeName: props.typeName,
      fieldName: props.fieldName,
      requestMappingTemplate: requestTemplate,
      responseMappingTemplate: responseTemplate,
      pipelineConfig: props.pipelineFunctions ? props.pipelineFunctions : undefined
    };

    if (props.dataSource) {
      return props.dataSource.createResolver(createResolverProps);
    }

    return this.graphqlApi.createResolver(createResolverProps);
  }

  /**
   * Creates an AppSync Function based on the supplied properties
   * @param props IGetFunctionProps: properties for creating the function
   * @returns AppsyncFunction object
   */
  private getFunction(props: IGetFunctionProps): AppsyncFunction {
    return props.dataSource.createFunction({
      name: props.name,
      description: props.description,
      requestMappingTemplate: MappingTemplate.fromFile(`${__dirname}/resolver/${props.reqTemplateStr}`),
      responseMappingTemplate: MappingTemplate.fromFile(`${__dirname}/resolver/Response.vtl`)
    });
  }
}

interface IGetFunctionProps {
  dataSource: DynamoDbDataSource;
  name: string;
  description: string;
  reqTemplateStr: string;
  resTemplateStr?: string;
}

interface IGetResolverProps {
  typeName: string;
  fieldName: string;
  reqTemplateStr: string;
  resTemplateStr?: string;
  dataSource?: DynamoDbDataSource;
  pipelineFunctions?: AppsyncFunction[];
}

enum AVATableLogicalIds {
  ISSUES_TABLE = 'AVAIssuesTable',
  DATA_HIERARCHY_TABLE = 'AVADataHierarchyTable'
}