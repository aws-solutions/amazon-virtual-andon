// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React, Amplify, and AWS SDK packages
import { API, graphqlOperation } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { Logger } from '@aws-amplify/core';

// Import graphql
import { getPrevDayIssuesStats, listSites, listAreas, listStations, listDevices, listProcesses, listEvents, listPermissions, issuesBySiteAreaStatus, issuesByDevice, listRootCauses } from '../graphql/queries';
import { deleteSite, deleteArea, deleteStation, deleteDevice, deleteProcess, deleteEvent, deletePermission, deleteRootCause } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL } from '../util/CustomUtil';
import { IGeneralQueryData, IEvent, IPermission, IIssue, IRootCause } from '../components/Interfaces';

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
      let response = await API.graphql(graphqlOperation(query, variables)) as GraphQLResult;
      let data: any = response.data;
      result = data[queryName].items;

      // Set nextToken
      if (!variables) {
        variables = {};
      }
      variables.nextToken = data[queryName].nextToken;

      while (variables.nextToken !== null) {
        response = await API.graphql(graphqlOperation(query, variables)) as GraphQLResult;
        data = response.data;
        result = [
          ...result,
          ...data[queryName].items
        ];
        variables.nextToken = data[queryName].nextToken;
      }

      return result;
    } catch (error) {
      LOGGER.error(error);
      throw error;
    }
  }

  /**
   * This returns the issue stats from the last 24 hours.
   * @return {Object} Returns an object of issues reported in the last 24 hours
   */
  async getPrevDayIssuesStats(): Promise<IGeneralQueryData[]> {
    let queryName = 'getPrevDayIssuesStats'
    let query = getPrevDayIssuesStats

    try {
      let result: any[] = [];
      let response = await API.graphql(graphqlOperation(query)) as GraphQLResult;
      let data: any = response.data;
      result = data[queryName];
      return result
    } catch (error) {
      LOGGER.error(error);
      throw error;
    }
  }

  /**
   * This returns the list of sites.
   * @return {Promise<IGeneralQueryData[]>} The list of sites
   */
  async listSites(): Promise<IGeneralQueryData[]> {
    return this.list('listSites', listSites, { limit: 50 });
  }

  /**
   * This returns the list of areas.
   * @param {string} areaSiteId - The area's site ID
   * @return {Promise<IGeneralQueryData[]>} The list of areas
   */
  async listAreas(areaSiteId: string): Promise<IGeneralQueryData[]> {
    return this.list('listAreas', listAreas, { areaSiteId });
  }

  /**
   * This returns the list of stations.
   * @param {string} stationAreaId - The station's area ID
   * @return {Promise<IGeneralQueryData[]>} The list of stations
   */
  async listStations(stationAreaId: string): Promise<IGeneralQueryData[]> {
    return this.list('listStations', listStations, { stationAreaId });
  }

  /**
   * This returns the list of devices.
   * @param {string} deviceStationId - The devices's station ID
   * @return {Promise<IGeneralQueryData[]>} The list of devices
   */
  async listDevices(deviceStationId: string): Promise<IGeneralQueryData[]> {
    return this.list('listDevices', listDevices, { deviceStationId });
  }

  /**
   * This returns the list of processes.
   * @param {string} processAreaId - The process's area ID
   * @return {Promise<IGeneralQueryData[]>} The list of processes
   */
  async listProcesses(processAreaId: string): Promise<IGeneralQueryData[]> {
    return this.list('listProcesses', listProcesses, { processAreaId });
  }

  /**
   * This returns the list of events with the supplied parent ID
   * @param parentId The parent ID to search by
   * @returns The list of events
   */
  async listEvents(parentId: string): Promise<IEvent[]> {
    return this.list('listEvents', listEvents, { parentId });
  }

  /**
   * This returns the list of events for the supplied eventProcessId
   * @param eventProcessId The parent ID to search by
   * @returns The list of events
   */
  async listEventsInProcess(eventProcessId: string): Promise<IEvent[]> {
    return this.list('listEvents', listEvents, { eventProcessId });
  }

  /**
   * This returns the list of permissions.
   * @return {Promise<IPermission[]>} The list of permissions
   */
  async listPermissions(): Promise<IPermission[]> {
    return this.list('listPermissions', listPermissions, { limit: 50 });
  }

  /**
   * This returns the list of issues by site, area, and status.
   * @param {any} variables - The GraphQL variables
   * @return {Promise<IIssue[]>} The list of issues
   */
  async listIssuesBySiteAreaStatus(variables: any): Promise<IIssue[]> {
    return this.list('issuesBySiteAreaStatus', issuesBySiteAreaStatus, variables);
  }

  /**
   * This returns the list of issues by device.
   * @param {any} variables - The GraphQL variables
   * @return {Promise<IIssue[]>} The list of issues
   */
  async listIssueByDevice(variables: any): Promise<IIssue[]> {
    return this.list('issuesByDevice', issuesByDevice, variables);
  }

  /**
   * This returns the list of root causes.
   * @return {Promise<IRootCause[]>} The list of root causes
   */
  async listRootCauses(): Promise<IRootCause[]> {
    return this.list('listRootCauses', listRootCauses, { limit: 50 });
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
      const response = await API.graphql(graphqlOperation(query, variables)) as GraphQLResult;
      const data: any = response.data;

      return data[queryName];
    } catch (error) {
      LOGGER.error(error);
      throw error;
    }
  }

  /**
   * Delete a permission.
   * @param {string} id - User ID to delete the permission
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deletePermission(id: string): Promise<any> {
    return this.delete('deletePermission', deletePermission, { id });
  }

  /**
   * Delete a site and belonged areas, processes, stations, events, and devices.
   * @param {string} siteId - Site ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteSite(siteId: string): Promise<any> {
    const promises: Promise<any>[] = [];

    // Get the list of areas belonged to the site, and delete them.
    const areas = await this.listAreas(siteId);
    for (let area of areas) {
      promises.push(this.deleteArea(area.id as string));
    }

    await Promise.all(promises);
    return this.delete('deleteSite', deleteSite, { siteId });
  }

  /**
   * Delete an area and belonged processes, stations, events, and devices.
   * @param {string} areaId - Area ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteArea(areaId: string): Promise<any> {
    const promises: Promise<any>[] = [];

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
    return this.delete('deleteArea', deleteArea, { areaId });
  }

  /**
   * Delete a station and belonged devices.
   * @param {string} stationId - Station ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteStation(stationId: string): Promise<any> {
    const promises: Promise<any>[] = [];

    // Get the list of devices belonged to the station and delete them.
    const devices = await this.listDevices(stationId);
    for (let device of devices) {
      promises.push(this.deleteDevice(device.id as string));
    }

    await Promise.all(promises);
    return this.delete('deleteStation', deleteStation, { stationId });
  }

  /**
   * Delete a device.
   * @param {string} deviceId - device ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteDevice(deviceId: string): Promise<any> {
    return this.delete('deleteDevice', deleteDevice, { deviceId });
  }

  /**
   * Delete a process and belonged events.
   * @param {string} processId - Process ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteProcess(processId: string): Promise<any> {
    const promises: Promise<any>[] = [];

    // Get the list of events belonged to the process, and delete them.
    const events = await this.listEventsInProcess(processId);
    for (let event of events) {
      promises.push(this.deleteEvent(event.id as string));
    }

    await Promise.all(promises);
    return this.delete('deleteProcess', deleteProcess, { processId });
  }

  /**
   * Delete an event and Amazon SNS topic if existing.
   * @param {string} eventId - Event ID to delete
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteEvent(eventId: string): Promise<any> {
    return this.delete('deleteEvent', deleteEvent, { eventId });
  }

  /**
   * Delete a root cause.
   * @param {string} id - Root cause ID to delete the root cause
   * @return {Promise<any>} The return value by GraphQL after deletion
   */
  async deleteRootCause(id: string): Promise<any> {
    return this.delete('deleteRootCause', deleteRootCause, { id });
  }
}

export default GraphQLCommon;