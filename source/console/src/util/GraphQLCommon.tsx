/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

// Import React, Amplify, and AWS SDK packages
import { API, graphqlOperation } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';
import Auth from "@aws-amplify/auth";
import SNS from 'aws-sdk/clients/sns';

// Import graphql
import { listSites, listAreas, listStations, listDevices, listProcesses, listEvents, listPermissions, issuesBySiteAreaStatus, issuesByDevice, listRootCauses } from '../graphql/queries';
import { deleteSite, deleteArea, deleteStation, deleteDevice, deleteProcess, deleteEvent, deletePermission, deleteRootCause } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL } from '../util/CustomUtil';
import { IGeneralQueryData, IEvent, IPermission, IIssue, IRootCause } from '../components/Interfaces';

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;

// Logging
const LOGGER = new Logger('GraphQLCommon', LOGGING_LEVEL);

/**
 * This class deals the common GraphQL queries.
 * @class GraphQLCommon
 */
class GraphQLCommon {
  /**
   * This is a general list function returning the list of query result.
   * @param {string} queryName - Query name
   * @param {string} query - GraphQL query
   * @param {any | undefined} variables - GraphQL variables
   * @return {Promise<any[]>} The list of query result
   */
  async list(queryName: string, query: string, variables?: any): Promise<any[]> {
    try {
      let result: any[] = [];
      let response = await API.graphql(graphqlOperation(query, variables));
      result = response.data[queryName].items;

      // Set nextToken
      if (!variables) {
        variables = {};
      }
      variables.nextToken = response.data[queryName].nextToken;

      while (variables.nextToken !== null) {
        response = await API.graphql(graphqlOperation(query, variables));
        result = [
          ...result,
          ...response.data[queryName].items
        ];
        variables.nextToken = response.data[queryName].nextToken;
      }

      return result;
    } catch (error) {
      LOGGER.error(error);
      throw error;
    }
  }

  /**
   * This returns the list of sites.
   * @return {Proimse<IGeneralQueryData[]} The list of sites
   */
  async listSites(): Promise<IGeneralQueryData[]> {
    return await this.list('listSites', listSites, { limit: 50 });
  }

  /**
   * This returns the list of areas.
   * @param {string} areaSiteId - The area's site ID
   * @return {Proimse<IGeneralQueryData[]} The list of areas
   */
  async listAreas(areaSiteId: string): Promise<IGeneralQueryData[]> {
    return await this.list('listAreas', listAreas, { areaSiteId });
  }

  /**
   * This returns the list of stations.
   * @param {string} stationAreaId - The station's area ID
   * @return {Proimse<IGeneralQueryData[]} The list of stations
   */
  async listStations(stationAreaId: string): Promise<IGeneralQueryData[]> {
    return await this.list('listStations', listStations, { stationAreaId });
  }

  /**
   * This returns the list of devices.
   * @param {string} deviceStationId - The devices's station ID
   * @return {Proimse<IGeneralQueryData[]} The list of devices
   */
  async listDevices(deviceStationId: string): Promise<IGeneralQueryData[]> {
    return await this.list('listDevices', listDevices, { deviceStationId });
  }

  /**
   * This returns the list of processes.
   * @param {string} processAreaId - The process's area ID
   * @return {Proimse<IGeneralQueryData[]} The list of processes
   */
  async listProcesses(processAreaId: string): Promise<IGeneralQueryData[]> {
    return await this.list('listProcesses', listProcesses, { processAreaId });
  }

  /**
   * This returns the list of events.
   * @param {string} eventProcessId - The event's process ID
   * @return {Proimse<IEvent[]} The list of events
   */
  async listEvents(eventProcessId: string): Promise<IEvent[]> {
    return await this.list('listEvents', listEvents, { eventProcessId });
  }

  /**
   * This returns the list of permissions.
   * @return {Proimse<IPermission[]} The list of permissions
   */
  async listPermissions(): Promise<IPermission[]> {
    return await this.list('listPermissions', listPermissions, { limit: 50 });
  }

  /**
   * This returns the list of issues by site, area, and status.
   * @param {any} variables - The GraphQL variables
   * @return {Proimse<IIssue[]} The list of issues
   */
  async listIssuesBySiteAreaStatus(variables: any): Promise<IIssue[]> {
    return await this.list('issuesBySiteAreaStatus', issuesBySiteAreaStatus, variables);
  }

  /**
   * This returns the list of issues by device.
   * @param {any} variables - The GraphQL variables
   * @return {Proimse<IIssue[]} The list of issues
   */
  async listIssueByDevice(variables: any): Promise<IIssue[]> {
    return await this.list('issuesByDevice', issuesByDevice, variables);
  }

  /**
   * This returns the list of root causes.
   * @return {Proimse<IRootCause[]} The list of root causes
   */
  async listRootCauses(): Promise<IRootCause[]> {
    return await this.list('listRootCauses', listRootCauses, { limit: 50 });
  }

  /**
   * This is a general delete function deleting an object.
   * @param {string} queryName - Query name
   * @param {string} query - GraphQL query
   * @param {any} variables - GraphQL variables
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async delete(queryName: string, query: string, variables: any): Promise<any> {
    try {
      const response = await API.graphql(graphqlOperation(query, variables));
      return response.data[queryName];
    } catch (error) {
      LOGGER.error(error);
      throw error;
    }
  }

  /**
   * Delete a permission.
   * @param {string} userId - User ID to delete the permission
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deletePermission(userId: string): Promise<any> {
    return await this.delete('deletePermission', deletePermission, { userId });
  }

  /**
   * Delete a site and belonged areas, processes, stations, events, and devices.
   * @param {string} siteId - Site ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteSite(siteId: string): Promise<any> {
    const promises = [];

    // Get the list of areas belonged to the site, and delete them.
    const areas = await this.listAreas(siteId);
    for (let area of areas) {
      promises.push(this.deleteArea(area.id as string));
    }

    await Promise.all(promises);
    return await this.delete('deleteSite', deleteSite, { siteId });
  }

  /**
   * Delete an area and belonged processes, stations, events, and devices.
   * @param {string} areaId - Area ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteArea(areaId: string): Promise<any> {
    const promises = [];

    // Get the list of processes and stations belonged to the area, and delete them.
    const processes = await this.listProcesses(areaId);
    for (let process of processes) {
      promises.push(this.deleteProcess(process.id as string));
    }

    const stations = await this.listStations(areaId);
    for (let station of stations) {
      promises.push(this.deleteStation(station.id as string));
    }

    await Promise.all(promises);
    return await this.delete('deleteArea', deleteArea, { areaId });
  }

  /**
   * Delete a station and belonged devices.
   * @param {string} stationId - Station ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteStation(stationId: string): Promise<any> {
    const promises = [];

    // Get the list of devices belonged to the station and delete them.
    const devices = await this.listDevices(stationId);
    for (let device of devices) {
      promises.push(this.deleteDevice(device.id as string));
    }

    await Promise.all(promises);
    return await this.delete('deleteStation', deleteStation, { stationId });
  }

  /**
   * Delete a device.
   * @param {string} deviceId - device ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteDevice(deviceId: string): Promise<any> {
    return await this.delete('deleteDevice', deleteDevice, { deviceId });
  }

  /**
   * Delete a process and belonged events.
   * @param {string} processId - Process ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteProcess(processId: string): Promise<any> {
    const promises = [];

    // Get the list of events belonged to the process, and delete them.
    const events = await this.listEvents(processId);
    for (let event of events) {
      promises.push(this.deleteEvent(event.id as string));
    }

    await Promise.all(promises);
    return await this.delete('deleteProcess', deleteProcess, { processId });
  }

  /**
   * Delete an event and Amazon SNS topic if existing.
   * @param {string} eventId - Event ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteEvent(eventId: string): Promise<any> {
    const response = await this.delete('deleteEvent', deleteEvent, { eventId });

    // Delete Amazon SNS topic if the event has one.
    if (response.topicArn && response.topicArn !== '') {
      await this.deleteSns(response.topicArn);
    }

    return response;
  }

  /**
   * Delete the Amazon SNS topic.
   * @param {string} topicArn - SNS Topic ARN
   */
  async deleteSns(topicArn: string) {
    const credentials = await Auth.currentCredentials();
    const sns = new SNS({
      apiVersion: '2010-03-31',
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(credentials)
    });

    try {
      await sns.deleteTopic({ TopicArn: topicArn }).promise();
    } catch (error) {
      throw new Error (error.message);
    }
  }

  /**
   * Delete a root cause.
   * @param {string} id - Root cause ID to delete the root cause
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteRootCause(id: string): Promise<any> {
    return await this.delete('deleteRootCause', deleteRootCause, { id });
  }
}

export default GraphQLCommon;