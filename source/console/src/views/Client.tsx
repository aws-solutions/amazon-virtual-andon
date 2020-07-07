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

// Import React and Amplify packages
import React from 'react';
import { API, graphqlOperation, PubSub, Auth } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Jumbotron from 'react-bootstrap/Jumbotron';
import ProgressBar from 'react-bootstrap/ProgressBar';

// Import graphql
import { getPermission } from '../graphql/queries';
import { onCreateIssue, onUpdateIssue, onPutPermission, onDeletePermission } from '../graphql/subscriptions';

// Import other packages
import * as uuid from 'uuid';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, addISOTimeOffset, getLocaleString } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData, IIssue, IEvent, ISelectedData, IPermission } from '../components/Interfaces';
import EmptyRow from '../components/EmptyRow';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  issues: IIssue[];
  permission: IPermission;
  sites: IGeneralQueryData[];
  areas: IGeneralQueryData[];
  processes: IGeneralQueryData[];
  stations: IGeneralQueryData[];
  devices: IGeneralQueryData[];
  events: IEvent[];
  selectedSite: ISelectedData;
  selectedArea: ISelectedData;
  selectedDevice: ISelectedData;
  selectedProcess: ISelectedData;
  selectedStation: ISelectedData;
  isLoading: boolean;
  error: string;
  showEvent: boolean;
}

// Logging
const LOGGER = new Logger('Client', LOGGING_LEVEL);

// Empty permission
const EMPTY_PERMISSION: IPermission = {
  userId: '',
  username: '',
  sites: [],
  areas: [],
  processes: [],
  stations: [],
  devices: [],
  version: 0
};

// Empty select
const EMPTY_SELECT: ISelectedData = { id: '', name: '' };

/**
 * The client page
 * @class Client
 */
class Client extends React.Component<IProps, IState> {
  // User ID
  private userId: string;
  // User groups
  private userGroups: string[];
  // Processing events - this will block duplicated events.
  private processingEvents: IEvent[];
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create issue subscription
  private createIssueSubscription: any;
  // Update issue subscription
  private updateIssuesubscription: any;
  // Put permission subscription
  private putPermissionSubscription: any;
  // Delete issue subscription
  private deletePermissionSubscription: any;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      issues: [],
      permission: EMPTY_PERMISSION,
      sites: [],
      areas: [],
      processes: [],
      stations: [],
      devices: [],
      events: [],
      selectedSite: EMPTY_SELECT,
      selectedArea: EMPTY_SELECT,
      selectedDevice: EMPTY_SELECT,
      selectedProcess: EMPTY_SELECT,
      selectedStation: EMPTY_SELECT,
      isLoading: false,
      error: '',
      showEvent: false
    };

    this.userId = '';
    this.userGroups = [];
    this.processingEvents = [];
    this.graphQlCommon = new GraphQLCommon();

    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.handleProcessChange = this.handleProcessChange.bind(this);
    this.handleStationChange = this.handleStationChange.bind(this);
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
    this.handleEventClick = this.handleEventClick.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get user information
    await this.getUser();

    // Get Local storage to set the inital site, area, and process.
    try {
      const avaCache = localStorage.getItem('ava_cache');

      if (avaCache) {
        const selectedSite = this.getLocalStorage('selectedSite');
        const selectedArea = this.getLocalStorage('selectedArea');
        const selectedProcess = this.getLocalStorage('selectedProcess');
        const selectedStation = this.getLocalStorage('selectedStation');
        const selectedDevice = this.getLocalStorage('selectedDevice');

        this.setState({ selectedSite: selectedSite ? selectedSite : EMPTY_SELECT });
        this.setState({ selectedArea: selectedArea ? selectedArea : EMPTY_SELECT });
        this.setState({ selectedProcess: selectedProcess ? selectedProcess : EMPTY_SELECT });
        this.setState({ selectedStation: selectedStation ? selectedStation : EMPTY_SELECT });
        this.setState({ selectedDevice: selectedDevice ? selectedDevice : EMPTY_SELECT });
      }
    } catch (error) {
      LOGGER.error('Error to get site, area, process, station, and device cache.');
      LOGGER.debug(error);
    }

    // Get user permission
    await this.getPermission();

    // Get sites at page load
    this.getSites();

    // Subscribe to new issues
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, selectedProcess, selectedStation, selectedDevice } = this.state;
        let { events } = this.state;
        const newIssue = response.value.data.onCreateIssue;
        const updatedIssues = [...issues, newIssue];

        if (selectedSite.name === newIssue.siteName && selectedArea.name === newIssue.areaName
          && selectedProcess.name === newIssue.processName && selectedStation.name === newIssue.stationName
          && selectedDevice.name === newIssue.deviceName) {
          events.filter((event: IEvent) => event.name === newIssue.eventDescription)
            .forEach((event: IEvent) => {
              event.isActive = true;
              event.activeIssueId = newIssue.id;
              event.updateIssueVersion = newIssue.version;
              event.createIssueTime = newIssue.created;
              event.isOpen = true;
              event.isAcknowledged = false;
              event.isClosedRejected = false;

              this.processingEvents = this.processingEvents.filter(processingEvent => processingEvent.id !== event.id);
            });
        }

        this.setState({
          issues: updatedIssues,
          events
        });
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to update issues
    this.updateIssuesubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, selectedProcess, selectedStation, selectedDevice } = this.state;
        let { events } = this.state;
        const updatedIssue = response.value.data.onUpdateIssue;
        const issueIndex = issues.findIndex(issue => issue.id === updatedIssue.id);
        const updatedIssues = [
          ...issues.slice(0, issueIndex),
          updatedIssue,
          ...issues.slice(issueIndex + 1)
        ];

        if (selectedSite.name === updatedIssue.siteName && selectedArea.name === updatedIssue.areaName
          && selectedProcess.name === updatedIssue.processName && selectedStation.name === updatedIssue.stationName
          && selectedDevice.name === updatedIssue.deviceName) {
          events.filter((event: IEvent) => event.name === updatedIssue.eventDescription)
            .forEach((event: IEvent) => {
              if (['closed', 'rejected'].includes(updatedIssue.status)) {
                event.isActive = false;
                event.isAcknowledged = false;
                event.isClosedRejected = true;
                event.activeIssueId = '';
                event.isOpen = false;
              } else if (updatedIssue.status === 'acknowledged') {
                event.updateIssueVersion = updatedIssue.version;
                event.createIssueTime = updatedIssue.created;
                event.isAcknowledged = true;
                event.isOpen = false;
              }

              this.processingEvents = this.processingEvents.filter(processingEvent => processingEvent.id !== event.id);
            });
        }

        this.setState({
          issues: updatedIssues,
          events
         });
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to put permission
    this.putPermissionSubscription = API.graphql(graphqlOperation(onPutPermission)).subscribe({
      next: (response: any) => {
        const putPermission = response.value.data.onPutPermission;

        if (this.userId === putPermission.userId) {
          this.refreshPermission(putPermission);
        }
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to delete permission
    this.deletePermissionSubscription = API.graphql(graphqlOperation(onDeletePermission)).subscribe({
      next: (response: any) => {
        const newPermission = response.value.data.onDeletePermission;

        if (this.userId === newPermission.userId) {
          this.refreshPermission(EMPTY_PERMISSION);
        }
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    this.updateIssuesubscription.unsubscribe();
    this.createIssueSubscription.unsubscribe();
    this.putPermissionSubscription.unsubscribe();
    this.deletePermissionSubscription.unsubscribe();
  }

  /**
   * Refresh the permission with the provided permission.
   * @param {IPermission} permission - New permission
   */
  async refreshPermission(permission: IPermission) {
    this.setState({
      permission: permission,
      sites: [],
      areas: [],
      processes: [],
      stations: [],
      devices: [],
      events: [],
      selectedSite: EMPTY_SELECT,
      selectedArea: EMPTY_SELECT,
      selectedDevice: EMPTY_SELECT,
      selectedProcess: EMPTY_SELECT,
      selectedStation: EMPTY_SELECT,
      showEvent: false
    }, () => {
      this.props.handleNotification(getLocaleString('Your permission has been changed.'), 'info', 300);
      this.setLocalStorage('selectedSite', EMPTY_SELECT);
      this.setLocalStorage('selectedArea', EMPTY_SELECT);
      this.setLocalStorage('selectedProcess', EMPTY_SELECT);
      this.setLocalStorage('selectedStation', EMPTY_SELECT);
      this.setLocalStorage('selectedDevice', EMPTY_SELECT);
      this.getSites();
    });
  }

  /**
   * Get the current user.
   */
  async getUser() {
    const user = await Auth.currentAuthenticatedUser();
    this.userId = user.signInUserSession.idToken.payload.sub;
    this.userGroups = user.signInUserSession.idToken.payload['cognito:groups'];

    // Filter user groups for associate group users only.
    this.userGroups = this.userGroups ? this.userGroups.filter(group => ['AdminGroup', 'ManagerGroup', 'EngineerGroup'].includes(group)) : [];
  }

  /**
   * Get a cached value from the local storage.
   * @param {string} name - The name of the local storage cache
   * @return {ISelectedData | undefined} The cache value
   */
  getLocalStorage(name: string): ISelectedData | undefined {
    try {
      let returnValue = undefined;
      const avaCache = localStorage.getItem('ava_cache');

      if (avaCache) {
        const cacheJson = JSON.parse(avaCache)[this.userId];

        if (cacheJson) {
          const cacheValue = cacheJson[name];

          if (cacheValue) {
            returnValue = JSON.parse(Buffer.from(cacheValue, 'base64').toString());
          }
        }
      }

      return returnValue;
    } catch (error) {
      LOGGER.error(`Error to get cache for ${name}.`);
      LOGGER.debug(error);
      return undefined;
    }
  }

  /**
   * Set the local storage cache value.
   * @param {string} name - The name of the local storage cache
   * @param {ISelectedData} value - The cache value
   */
  setLocalStorage(name: string, value: ISelectedData) {
    try {
      const cacheValue = Buffer.from(JSON.stringify(value)).toString('base64');
      const avaCache = localStorage.getItem('ava_cache');
      let cacheJson: any = {};

      if (avaCache) {
        cacheJson = JSON.parse(avaCache);
      }

      if (!cacheJson[this.userId]) {
        cacheJson[this.userId] = {};
      }

      cacheJson[this.userId][name] = cacheValue;
      localStorage.setItem('ava_cache', JSON.stringify(cacheJson));
    } catch (error) {
      LOGGER.error(`Error to set cache for ${name}.`);
      LOGGER.debug(error);
    }
  }

  /**
   * Get the user's permission.
   */
  async getPermission() {
    if (this.userId && this.userId !== '' && this.userGroups.length === 0) {
      const response = await API.graphql(graphqlOperation(getPermission, { userId: this.userId }));
      if (response.data.getPermission) {
        const permission: IPermission = response.data.getPermission;
        permission.username = '';

        this.setState({ permission });
      }
    }
  }

  /**
   * Get sites
   */
  async getSites() {
    try {
      let sites: IGeneralQueryData[] = [];

      /**
       * Permission is for users in Associate Group only.
       * If there's no permission for the associate user, the user gets nothing.
       */
      if (this.userGroups.length > 0 ||
        (this.userGroups.length === 0 && this.state.permission.userId !== '')) {
        sites = await this.graphQlCommon.listSites();

        if (this.userGroups.length === 0) {
          const permittedSites = this.state.permission.sites;
          sites = sites.filter(site =>
            permittedSites.map(permittedSite => {
              return permittedSite.id;
            }).includes(site.id)
          );
        }
      }

      if (sites.length === 1) {
        const selectedSite = {
          id: sites[0].id,
          name: sites[0].name
        };

        this.setLocalStorage('selectedSite', selectedSite);
      }

      const selectedSite = this.getLocalStorage('selectedSite');
      if (selectedSite && selectedSite.id && selectedSite.id !== '') {
        this.setState({ selectedSite });
        this.getAreas(selectedSite);
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ sites });
    } catch (error) {
      LOGGER.error('Error while getting sites', error);
      this.setState({ error: getLocaleString('Error occurred while getting sites.')});
    }
  }

  /**
   * Get areas
   * @param {object} selectedSite - Selected site
   */
  async getAreas(selectedSite: ISelectedData) {
    try {
      const siteId = selectedSite.id;
      let areas: IGeneralQueryData[] = [];

      /**
       * Permission is for users in Associate Group only.
       * If there's no permission for the associate user, the user gets nothing.
       */
      if (this.userGroups.length > 0 ||
        (this.userGroups.length === 0 && this.state.permission.userId !== '')) {
        areas = await this.graphQlCommon.listAreas(siteId as string);

        if (this.userGroups.length === 0) {
          const permittedAreas = this.state.permission.areas;
          areas = areas.filter(area =>
            permittedAreas.map(permittedArea => {
              return permittedArea.id;
            }).includes(area.id)
          );
        }
      }

      if (areas.length === 1) {
        const selectedArea = {
          id: areas[0].id,
          name: areas[0].name
        };

        this.setLocalStorage('selectedArea', selectedArea);
      }

      const selectedArea = this.getLocalStorage('selectedArea');
      if (selectedArea && selectedArea.id && selectedArea.id !== '') {
        this.setState({ selectedArea });
        this.getProcessesStations(selectedArea);
      }

      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ areas });
    } catch (error) {
      LOGGER.error('Error while getting areas', error);
      this.setState({ error: getLocaleString('Error occurred while getting areas.')});
    }
  }

  /**
   * Get processes and stations by area
   * @param {object} selectedArea - Selected area
   */
  async getProcessesStations(selectedArea: ISelectedData) {
    try {
      const areaId = selectedArea.id;
      let processes: IGeneralQueryData[] = [];
      let stations: IGeneralQueryData[] = [];

      /**
       * Permission is for users in Associate Group only.
       * If there's no permission for the associate user, the user gets nothing.
       */
      if (this.userGroups.length > 0 ||
        (this.userGroups.length === 0 && this.state.permission.userId !== '')) {
        processes = await this.graphQlCommon.listProcesses(areaId as string);
        stations = await this.graphQlCommon.listStations(areaId as string);

        if (this.userGroups.length === 0) {
          const permittedProcesses = this.state.permission.processes;
          processes = processes.filter(process =>
            permittedProcesses.map(permittedProcess => {
              return permittedProcess.id;
            }).includes(process.id)
          );

          const permittedStations = this.state.permission.stations;
          stations = stations.filter(station =>
            permittedStations.map(permittedStation => {
              return permittedStation.id;
            }).includes(station.id)
          );
        }
      }

      if (processes.length === 1) {
        const selectedProcess = {
          id: processes[0].id,
          name: processes[0].name
        };

        this.setLocalStorage('selectedProcess', selectedProcess);
        this.setState({ selectedProcess });
      }
      processes.sort((a, b) => a.name.localeCompare(b.name));

      if (stations.length === 1) {
        const selectedStation = {
          id: stations[0].id,
          name: stations[0].name
        };

        this.setLocalStorage('selectedStation', selectedStation);
      }

      const selectedStation = this.getLocalStorage('selectedStation');
      if (selectedStation && selectedStation.id && selectedStation.id !== '') {
        this.setState({ selectedStation });
        this.getDevices(selectedStation);
      }

      stations.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        processes,
        stations
      });
    } catch (error) {
      LOGGER.error('Error while getting processes and stations', error);
      this.setState({ error: getLocaleString('Error occurred while getting processes and stations.')});
    }
  }

  /**
   * Get devices by station
   * @param {object} selectedStation - Selected station
   */
  async getDevices(selectedStation: ISelectedData) {
    const { selectedProcess } = this.state;

    try {
      const stationId = selectedStation.id;
      let devices: IGeneralQueryData[] = [];

      /**
       * Permission is for users in Associate Group only.
       * If there's no permission for the associate user, the user gets nothing.
       */
      if (this.userGroups.length > 0 ||
        (this.userGroups.length === 0 && this.state.permission.userId !== '')) {
        devices = await this.graphQlCommon.listDevices(stationId as string);

        if (this.userGroups.length === 0) {
          const permittedDevices = this.state.permission.devices;
          devices = devices.filter(device =>
            permittedDevices.map(permittedDevice => {
              return permittedDevice.id;
            }).includes(device.id)
          );
        }
      }

      if (devices.length === 1) {
        const selectedDevice = {
          id: devices[0].id,
          name: devices[0].name
        };

        this.setLocalStorage('selectedDevice', selectedDevice);
        this.setState({ selectedDevice });
      }

      const selectedDevice = this.getLocalStorage('selectedDevice');
      if (selectedDevice && selectedDevice.id && selectedDevice.id !== '') {
        this.getEvents(selectedProcess);
        this.getIssues(selectedDevice, selectedProcess);
      }

      devices.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ devices });
    } catch (error) {
      LOGGER.error('Error while getting devices', error);
      this.setState({ error: getLocaleString('Error occurred while getting devices.')});
    }
  }

  /**
   * Get issues by the deivce and the process
   * @param {object} selectedDevice - Selected device
   * @param {object} selectedProcess - Selected process
   */
  async getIssues(selectedDevice: ISelectedData, selectedProcess: ISelectedData) {
    try {
      const { selectedSite, selectedArea, selectedStation } = this.state;
      const selectedSiteName = selectedSite.name;

      // Get open issues
      const input = {
        siteName: selectedSiteName,
        areaNameStatusProcessNameStationNameDeviceNameCreated: {
          beginsWith: {
            areaName: selectedArea.name,
            status: 'open',
            processName: selectedProcess.name,
            stationName: selectedStation.name,
            deviceName: selectedDevice.name
          }
        },
        limit: 20
      };
      let issues: IIssue[] = await this.graphQlCommon.listIssueByDevice(input);

      // Get acknowledged issues
      input.areaNameStatusProcessNameStationNameDeviceNameCreated.beginsWith.status = 'acknowledged';
      issues = [
        ...issues,
        ...await this.graphQlCommon.listIssueByDevice(input)
      ];

      const { events } = this.state;
      issues.filter((issue: IIssue) => issue.deviceName === selectedDevice.name)
        .forEach((issue: IIssue) => {
          events.filter((event: IEvent) => event.name === issue.eventDescription)
            .forEach((event: IEvent) => {
              event.isActive = true;
              event.activeIssueId = issue.id;
              event.updateIssueVersion = issue.version;
              event.createIssueTime = issue.created;

              if (issue.status === 'acknowledged') {
                event.isAcknowledged = true;
                event.isClosedRejected = false;
                event.isOpen = false;
              } else if (issue.status === 'open') {
                event.isOpen = true;
                event.isClosedRejected = false;
                event.isAcknowledged = false;
              } else if (['closed', 'rejected'].includes(issue.status)) {
                event.isActive = false;
                event.isAcknowledged = false;
                event.isOpen = false;
                event.isClosedRejected = true;
              }
            });
        });

      issues.sort((a, b) => a.status.localeCompare(b.status));
      this.setState({
        issues,
        events,
      });
    } catch (error) {
      LOGGER.error('Error while getting issues', error);
      this.setState({ error: getLocaleString('Error occurred while getting issues.')});
    }
  }

  /**
   * Get events by the device and the process
   * @param {object} selectedProcess - Selected Process
   */
  async getEvents(selectedProcess: ISelectedData) {
    if (selectedProcess.id === '' || selectedProcess.id === undefined) {
      return;
    }

    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const events: IEvent[] = await this.graphQlCommon.listEvents(selectedProcess.id);

      for (let event of events) {
        event.isActive = false;
        event.isAcknowledged = false;
        event.isOpen = false;
      }

      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ events });
    } catch (error) {
      LOGGER.error('Error while getting events', error);
      this.setState({ error: getLocaleString('Error occurred while getting events.')});
    }

    this.setState({
      isLoading: false,
      showEvent: true
    });
  }

  /**
   * Handle site select change event.
   * @param {any} event - Event from the site select
   */
  handleSiteChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedSite = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setLocalStorage('selectedSite', selectedSite);
    this.setLocalStorage('selectedArea', EMPTY_SELECT);
    this.setLocalStorage('selectedProcess', EMPTY_SELECT);
    this.setLocalStorage('selectedStation', EMPTY_SELECT);
    this.setLocalStorage('selectedDevice', EMPTY_SELECT);
    this.setState({
      selectedSite,
      selectedArea: EMPTY_SELECT,
      selectedDevice: EMPTY_SELECT,
      selectedProcess: EMPTY_SELECT,
      selectedStation: EMPTY_SELECT,
      areas: [],
      processes: [],
      stations: [],
      devices: [],
      events: [],
      showEvent: false
    });

    this.getAreas(selectedSite);
  }

  /**
   * Handle area select change event.
   * @param {any} event - Event from the area select
   */
  handleAreaChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedArea = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setLocalStorage('selectedArea', selectedArea);
    this.setLocalStorage('selectedProcess', EMPTY_SELECT);
    this.setLocalStorage('selectedStation', EMPTY_SELECT);
    this.setLocalStorage('selectedDevice', EMPTY_SELECT);
    this.setState({
      selectedArea,
      selectedProcess: EMPTY_SELECT,
      selectedStation: EMPTY_SELECT,
      selectedDevice: EMPTY_SELECT,
      processes: [],
      stations: [],
      devices: [],
      events: [],
      showEvent: false
    });

    this.getProcessesStations(selectedArea);
  }

  /**
   * Handle process select change event.
   * @param {any} event - Event from the process select
   */
  handleProcessChange(event: any) {
    const { selectedDevice } = this.state;
    const index = event.target.options.selectedIndex;
    const selectedProcess = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setLocalStorage('selectedProcess', selectedProcess);
    this.setState({
      selectedProcess,
      events: [],
      showEvent: false
    });

    if (selectedDevice.name !== '') {
      this.getEvents(selectedProcess);
      this.getIssues(selectedDevice, selectedProcess);
    }
  }

  /**
   * Handle station select change event.
   * @param {any} event - Event from the station select
   */
  handleStationChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedStation = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setLocalStorage('selectedStation', selectedStation);
    this.setLocalStorage('selectedDevice', EMPTY_SELECT);
    this.setState({
      selectedStation,
      selectedDevice: EMPTY_SELECT,
      devices: [],
      events: [],
      showEvent: false
    });

    this.getDevices(selectedStation);
  }

  /**
   * Handle device select change event.
   * @param {any} event - Event from the device select
   */
  handleDeviceChange(event: any) {
    const { selectedProcess } = this.state;
    const index = event.target.options.selectedIndex;
    const selectedDevice = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setLocalStorage('selectedDevice', selectedDevice);
    this.setState({
      selectedDevice,
      events: [],
      showEvent: false
    });

    if (selectedProcess.name !== '') {
      this.getEvents(selectedProcess);
      this.getIssues(selectedDevice, selectedProcess);
    }
  }

  /**
   * Handle event click
   * @param {IEvent} event - Clicked event
   */
  async handleEventClick(event: IEvent) {
    const promises = [];

    // If there's processing events, it won't publish messages for the event anymore.
    if (this.processingEvents.filter(processingEvent => processingEvent.id === event.id).length === 0) {
      const { selectedSite, selectedArea, selectedProcess, selectedStation, selectedDevice } = this.state;
      let issueToPublish: object;
      if (!event.isActive) {
        issueToPublish = {
          id: uuid.v1(),
          eventId: event.id,
          eventDescription: event.name,
          type: event.type,
          priority: event.priority,
          topicArn: event.topicArn,
          siteName: selectedSite.name,
          areaName: selectedArea.name,
          processName: selectedProcess.name,
          stationName: selectedStation.name,
          deviceName: selectedDevice.name,
          created: addISOTimeOffset(new Date()),
          status: 'open'
        };

        promises.push(sendMetrics({ 'issue': 1 }));
      } else {
        let issueClosedTimestamp = addISOTimeOffset(new Date());
        let resolutionTime = Math.ceil((new Date(issueClosedTimestamp).valueOf() - new Date(event.createIssueTime as string).valueOf()) / 1000);
        issueToPublish = {
          id: event.activeIssueId,
          eventId: event.id,
          eventDescription: event.name,
          type: event.type,
          priority: event.priority,
          topicArn: event.topicArn,
          siteName: selectedSite.name,
          areaName: selectedArea.name,
          processName: selectedProcess.name,
          stationName: selectedStation.name,
          deviceName: selectedDevice.name,
          created: event.createIssueTime,
          closed: issueClosedTimestamp,
          resolutionTime: resolutionTime,
          status: 'closed',
          expectedVersion: event.updateIssueVersion
        };
      }

      try {
        this.processingEvents.push(event);
        await PubSub.publish('ava/issues', issueToPublish);

        if (promises.length > 0) {
          await Promise.all(promises);
        }
      } catch (error) {
        this.processingEvents = this.processingEvents.filter(processingEvent => processingEvent.id !== event.id);
        LOGGER.error('Error occurred to publish an issue.', error);
      }
    }
  }

  /**
   * Render this page.
   */
  render() {
    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{ getLocaleString('Client') }</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} xs={6} sm={3} md={2} controlId="siteSelect">
                        <Form.Label>{ getLocaleString('Site Name') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedSite.name} onChange={this.handleSiteChange}>
                          <option data-key="" key="none-site" value="">{ getLocaleString('Select Site') }</option>
                          {
                            this.state.sites.map((site: IGeneralQueryData) => {
                              return (
                                <option data-key={site.id} key={site.id} value={site.name}>{site.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} xs={6} sm={3} md={2} controlId="areaSelect">
                        <Form.Label>{ getLocaleString('Area Name') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="">{ getLocaleString('Select Area') }</option>
                          {
                            this.state.areas.map((area: IGeneralQueryData) => {
                              return (
                                <option data-key={area.id} key={area.id} value={area.name}>{area.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} xs={6} sm={3} md={2} controlId="processSelect">
                        <Form.Label>{ getLocaleString('Process Name') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedProcess.name} onChange={this.handleProcessChange}>
                          <option data-key="" key="none-process" value="">{ getLocaleString('Select Process') }</option>
                          {
                            this.state.processes.map((process: IGeneralQueryData) => {
                              return (
                                <option data-key={process.id} key={process.id} value={process.name}>{process.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} xs={6} sm={3} md={2} controlId="stationSelect">
                        <Form.Label>{ getLocaleString('Station Name') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedStation.name} onChange={this.handleStationChange}>
                          <option data-key="" key="none-station" value="">{ getLocaleString('Select Station') }</option>
                          {
                            this.state.stations.map((station: IGeneralQueryData) => {
                              return (
                                <option data-key={station.id} key={station.id} value={station.name}>{station.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} xs={6} sm={3} md={2} controlId="deviceSelect">
                        <Form.Label>{ getLocaleString('Device Name') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedDevice.name} onChange={this.handleDeviceChange}>
                          <option data-key="" key="none-device" value="">{ getLocaleString('Select Device') }</option>
                          {
                            this.state.devices.map((device: IGeneralQueryData) => {
                              return (
                                <option data-key={device.id} key={device.id} value={device.name}>{device.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                    </Form.Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
            {
              this.state.showEvent && this.state.events.length === 0 && !this.state.isLoading &&
              <Jumbotron>
                <p>{ getLocaleString('No events found for the selected process. Please contact your administrator.') }</p>
              </Jumbotron>
            }
            {
              this.state.events.length > 0 &&
              <Card className="custom-card-big">
                <Row>
                {
                  this.state.events.map((event: IEvent) => {
                    let className = 'custom-card-event';
                    if (event.isOpen) {
                      className = className.concat(' ', 'event-open');
                    } else if (event.isAcknowledged) {
                      className = className.concat(' ', 'event-acknowledged');
                    } else if (event.isClosedRejected) {
                      className = className.concat(' ', 'event-closed-rejected');
                    }
                    return (
                      <Col xs={6} sm={3} md={3} key={event.id}>
                        <Card className={className} onClick={async () => this.handleEventClick(event)}>
                          <Card.Body>
                            <Card.Title>{event.name}</Card.Title>
                            <Card.Text>{event.description}</Card.Text>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })
                }
                </Row>
              </Card>
            }
            </Col>
          </Row>
          {
            this.state.isLoading &&
            <Row>
              <Col>
                <ProgressBar animated now={100} />
              </Col>
            </Row>
          }
          {
            this.state.error &&
            <Row>
              <Col>
                <Alert variant="danger">
                  <strong>{ getLocaleString('Error') }:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
      </div>
    );
  }
}

export default Client;