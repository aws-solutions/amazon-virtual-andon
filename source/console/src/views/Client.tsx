// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { API, graphqlOperation, PubSub, Auth, I18n } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { Logger } from '@aws-amplify/core';
import { RouteComponentProps } from 'react-router';
import { AmplifyS3Image } from "@aws-amplify/ui-react";

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import CardGroup from 'react-bootstrap/CardGroup';
import Alert from 'react-bootstrap/Alert';
import Jumbotron from 'react-bootstrap/Jumbotron';
import ProgressBar from 'react-bootstrap/ProgressBar';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table'
import { BsFillExclamationCircleFill } from 'react-icons/bs';
import { RiArrowGoBackFill } from 'react-icons/ri';
import {Buffer} from 'buffer';

// Import graphql
import { getPermission } from '../graphql/queries';
import { onCreateIssue, onUpdateIssue, onPutPermission, onDeletePermission } from '../graphql/subscriptions';

// Import other packages
import * as uuid from 'uuid';
import moment from 'moment';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, addISOTimeOffset, handleSubscriptionError, convertSecondsToHms } from '../util/CustomUtil';
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
  location?: any;
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
  showModal: boolean;
  modalAnomalyDetectionTime: string;
  modalPredictionScore: string;
  modalDiagnostics: { name: string, value: string }[],
  modalDiagnosticsMaxValue: number;
  currentParentEventId: string;
}

// Logging
const LOGGER = new Logger('Client', LOGGING_LEVEL);

// Empty permission
const EMPTY_PERMISSION: IPermission = {
  id: '',
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
 * Types of subscriptions that will be maintained by the main Client class
 */
export enum ClientSubscriptionTypes {
  CREATE_ISSUE,
  UPDATE_ISSUE,
  PUT_PERMISSION,
  DELETE_ISSUE
}

/**
 * The client page
 * @class Client
 */
class Client extends React.Component<IProps, IState, RouteComponentProps> {
  // User ID
  private userId: string;
  // Username
  private username: string;
  // User groups
  private userGroups: string[];
  // Processing events - this will block duplicated events.
  private processingEvents: IEvent[];
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create issue subscription
  private createIssueSubscription: any;
  // Update issue subscription
  private updateIssueSubscription: any;
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
      showEvent: false,
      showModal: false,
      modalAnomalyDetectionTime: '',
      modalPredictionScore: '',
      modalDiagnostics: [],
      modalDiagnosticsMaxValue: 0,
      currentParentEventId: ''
    };

    this.userId = '';
    this.username = '';
    this.userGroups = [];
    this.processingEvents = [];
    this.graphQlCommon = new GraphQLCommon();

    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.handleProcessChange = this.handleProcessChange.bind(this);
    this.handleStationChange = this.handleStationChange.bind(this);
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
    this.handleEventClick = this.handleEventClick.bind(this);
    this.getInitialSelectItem = this.getInitialSelectItem.bind(this);
    this.configureSubscription = this.configureSubscription.bind(this);
    this.toggleModal = this.toggleModal.bind(this);
    this.hasOpenSubEvents = this.hasOpenSubEvents.bind(this);
    this.hasAcknowledgedSubEvents = this.hasAcknowledgedSubEvents.bind(this);
    this.clickedSubEventModalBack = this.clickedSubEventModalBack.bind(this);
    this.getNumSubEventsWithStatus = this.getNumSubEventsWithStatus.bind(this);
    this.outputEventNameForCardTitle = this.outputEventNameForCardTitle.bind(this);
    this.getFullEventDescription = this.getFullEventDescription.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get user information
    await this.getUser();

    // Get Local storage to set the initial site, area, and process.
    if (!this.props.location.search) {
      try {
        const avaCache = localStorage.getItem('ava_cache');

        this.setupResourceInfo(avaCache);
      } catch (error) {
        LOGGER.error('Error to get site, area, process, station, and device cache.');
        LOGGER.debug(error);
      }
    }

    // Get user permission
    await this.getPermission();

    // Get sites at page load
    this.getSites();

    // Configure subscriptions
    await this.configureSubscription(ClientSubscriptionTypes.CREATE_ISSUE);
    await this.configureSubscription(ClientSubscriptionTypes.UPDATE_ISSUE);
    await this.configureSubscription(ClientSubscriptionTypes.PUT_PERMISSION);
    await this.configureSubscription(ClientSubscriptionTypes.DELETE_ISSUE);
  }

  private setupResourceInfo(avaCache: string | null) {
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
  }

  /**
   * Configures the subscription for the supplied `subscriptionType`
   * @param subscriptionType The type of subscription to configure
   * @param delayMS (Optional) This value will be used to set a delay for reestablishing the subscription if the socket connection is lost
   */
  async configureSubscription(subscriptionType: ClientSubscriptionTypes, delayMS: number = 10): Promise<void> {
    try {
      switch (subscriptionType) {
        case ClientSubscriptionTypes.CREATE_ISSUE:
          this.createIssue(subscriptionType, delayMS);
          break;
        case ClientSubscriptionTypes.DELETE_ISSUE:
          if (this.deletePermissionSubscription) { this.deletePermissionSubscription.unsubscribe(); }

          // @ts-ignore
          this.deletePermissionSubscription = API.graphql(graphqlOperation(onDeletePermission)).subscribe({
            next: (response: any) => {
              const newPermission = response.value.data.onDeletePermission;

              if (this.userId === newPermission.userId) {
                this.refreshPermission(EMPTY_PERMISSION);
              }
            },
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
        case ClientSubscriptionTypes.PUT_PERMISSION:
          if (this.putPermissionSubscription) { this.putPermissionSubscription.unsubscribe(); }

          // @ts-ignore
          this.putPermissionSubscription = API.graphql(graphqlOperation(onPutPermission)).subscribe({
            next: (response: any) => {
              const putPermission = response.value.data.onPutPermission;

              if (this.userId === putPermission.userId) {
                this.refreshPermission(putPermission);
              }
            },
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
        case ClientSubscriptionTypes.UPDATE_ISSUE:
          this.updateIssue(subscriptionType, delayMS);
          break;
      }
    } catch (err) {
      console.error('Unable to configure subscription', err);
    }
  }

  private updateIssue(subscriptionType: ClientSubscriptionTypes, delayMS: number) {
    if (this.updateIssueSubscription) { this.updateIssueSubscription.unsubscribe(); }
    // @ts-ignore
    this.updateIssueSubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
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
          events.filter((event: IEvent) => event.id === updatedIssue.eventId)
            .forEach((event: IEvent) => {
              if (['closed', 'rejected'].includes(updatedIssue.status)) {
                event.isActive = false;
                event.isAcknowledged = false;
                event.isClosedRejected = true;
                event.activeIssueId = '';
                delete event.createIssueTimeUtc;
                event.isOpen = false;
              } else if (updatedIssue.status === 'acknowledged') {
                event.updateIssueVersion = updatedIssue.version;
                event.createIssueTime = updatedIssue.created;
                delete event.createIssueTimeUtc;
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
      error: async (e: any) => {
        await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
      }
    });
  }

  private createIssue(subscriptionType: ClientSubscriptionTypes, delayMS: number) {
    if (this.createIssueSubscription) { this.createIssueSubscription.unsubscribe(); }

    // @ts-ignore
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, selectedProcess, selectedStation, selectedDevice } = this.state;
        let { events } = this.state;
        const newIssue = response.value.data.onCreateIssue;
        const updatedIssues = [...issues, newIssue];

        if (selectedSite.name === newIssue.siteName && selectedArea.name === newIssue.areaName
          && selectedProcess.name === newIssue.processName && selectedStation.name === newIssue.stationName
          && selectedDevice.name === newIssue.deviceName) {
          events.filter((event: IEvent) => event.id === newIssue.eventId)
            .forEach((event: IEvent) => {
              event.isActive = true;
              event.activeIssueId = newIssue.id;
              event.updateIssueVersion = newIssue.version;
              event.createIssueTime = newIssue.created;
              event.createIssueTimeUtc = newIssue.createdAt;
              event.isOpen = true;
              event.isAcknowledged = false;
              event.isClosedRejected = false;
              event.issueAdditionalDetails = newIssue.additionalDetails;

              this.processingEvents = this.processingEvents.filter(processingEvent => processingEvent.id !== event.id);
            });
        }

        this.setState({
          issues: updatedIssues,
          events
        });
      },
      error: async (e: any) => {
        await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
      }
    });
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    if (this.updateIssueSubscription) this.updateIssueSubscription.unsubscribe();
    if (this.createIssueSubscription) this.createIssueSubscription.unsubscribe();
    if (this.putPermissionSubscription) this.putPermissionSubscription.unsubscribe();
    if (this.deletePermissionSubscription) this.deletePermissionSubscription.unsubscribe();
  }

  /**
   * React componentDidUpdate function
   */
  componentDidUpdate(prevProps: IProps, prevState: IState) {
    const queryParams = new URLSearchParams(this.props.location.search);
    let queryKeyToUpdate = "";
    let selectKeysPrefix = "selected"
    let newQueryValue;
    let key: keyof IState;

    for (key in this.state) {
      if (key.startsWith(selectKeysPrefix) && prevState[key] !== this.state[key]) {
        const queryKey = key.slice(selectKeysPrefix.length, key.length).toLowerCase();
        if (this.state[key] !== EMPTY_SELECT) {
          newQueryValue = (this.state[key] as ISelectedData).id;
          queryKeyToUpdate = queryKey
        } else {
          queryParams.delete(queryKey);
        }
      }
    }

    if (queryKeyToUpdate !== "" && newQueryValue !== undefined) {
      queryParams.set(queryKeyToUpdate, newQueryValue)
      this.props.history.replace({ search: `?${queryParams.toString()}` })
    }
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
      this.props.handleNotification(I18n.get('info.change.permission'), 'info', 300);
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
    this.username = user.username;
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
      const response = await API.graphql(graphqlOperation(getPermission, { id: this.userId })) as GraphQLResult;
      const data: any = response.data;
      if (data.getPermission) {
        const permission: IPermission = data.getPermission;
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
        (this.userGroups.length === 0 && this.state.permission.id !== '')) {
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

      const initialSite = this.getInitialSelectItem('Site', sites);
      if (initialSite) this.setLocalStorage('selectedSite', initialSite);

      const selectedSite = this.getLocalStorage('selectedSite');
      if (selectedSite && selectedSite.id && selectedSite.id !== '') {
        this.setState({ selectedSite });
        this.getAreas(selectedSite);
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ sites });
    } catch (error) {
      LOGGER.error('Error while getting sites', error);
      this.setState({ error: I18n.get('error.get.sites') });
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
        (this.userGroups.length === 0 && this.state.permission.id !== '')) {
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

      const initialArea = this.getInitialSelectItem('Area', areas);
      if (initialArea) this.setLocalStorage('selectedArea', initialArea);

      const selectedArea = this.getLocalStorage('selectedArea');
      if (selectedArea && selectedArea.id && selectedArea.id !== '') {
        this.setState({ selectedArea });
        this.getProcessesStations(selectedArea);
      }

      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ areas });
    } catch (error) {
      LOGGER.error('Error while getting areas', error);
      this.setState({ error: I18n.get('error.get.areas') });
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
        (this.userGroups.length === 0 && this.state.permission.id !== '')) {
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

      const initialProcess = this.getInitialSelectItem('Process', processes);
      if (initialProcess) {
        this.setLocalStorage('selectedProcess', initialProcess);
        this.setState({ selectedProcess: initialProcess });
      }
      processes.sort((a, b) => a.name.localeCompare(b.name));

      const initialStation = this.getInitialSelectItem('Station', stations);
      if (initialStation) this.setLocalStorage('selectedStation', initialStation);

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
      this.setState({ error: I18n.get('error.get.processes.stations') });
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
        (this.userGroups.length === 0 && this.state.permission.id !== '')) {
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

      const initialDevice = this.getInitialSelectItem('Device', devices);
      if (initialDevice) {
        this.setLocalStorage('selectedDevice', initialDevice);
        this.setState({ selectedDevice: initialDevice });
      }

      const selectedDevice = this.getLocalStorage('selectedDevice');
      if (
        selectedDevice && selectedDevice.id && selectedDevice.id !== '' &&
        selectedProcess && selectedProcess.id && selectedProcess.id !== ''
      ) {
        await this.getEvents(selectedProcess);
        await this.getIssues(selectedDevice, selectedProcess);
      }

      devices.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ devices });
    } catch (error) {
      LOGGER.error('Error while getting devices', error);
      this.setState({ error: I18n.get('error.get.devices') });
    }
  }

  /**
   * Get issues by the device and the process
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
          events.filter((event: IEvent) => event.id === issue.eventId)
            .forEach((event: IEvent) => {
              event.isActive = true;
              event.activeIssueId = issue.id;
              event.updateIssueVersion = issue.version;
              event.createIssueTime = issue.created;
              event.createIssueTimeUtc = issue.createdAt;
              event.issueAdditionalDetails = issue.additionalDetails;

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
      this.setState({ error: I18n.get('error.get.issues') });
    }
  }

  /**
   * Get events by the device and the process
   * @param {object} selectedProcess - Selected Process
   */
  async getEvents(selectedProcess: ISelectedData) {
    if (selectedProcess.id === '' || selectedProcess.id === undefined) { return; }

    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const events: IEvent[] = await this.graphQlCommon.listEventsInProcess(selectedProcess.id);

      for (let event of events) {
        event.isActive = false;
        event.isAcknowledged = false;
        event.isOpen = false;
      }

      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ events });
    } catch (error) {
      LOGGER.error('Error while getting events', error);
      this.setState({ error: I18n.get('error.get.events') });
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
  async handleProcessChange(event: any) {
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
      await this.getEvents(selectedProcess);
      await this.getIssues(selectedDevice, selectedProcess);
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
  async handleDeviceChange(event: any) {
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
      await this.getEvents(selectedProcess);
      await this.getIssues(selectedDevice, selectedProcess);
    }
  }

  /**
   * Handle event click
   * @param {IEvent} event - Clicked event
   */
  async handleEventClick(event: IEvent) {
    if (event.eventType && event.eventType.trim().toLowerCase() === 'automated') {
      LOGGER.warn('Automated events cannot be closed on the Client screen');
      return;
    }

    // Check if this event has sub events
    if (this.state.events.some(e => e.parentId === event.id)) {
      this.setState({ currentParentEventId: event.id! });
      return;
    }

    const promises: Promise<void>[] = [];

    // If there's processing events, it won't publish messages for the event anymore.
    if (this.processingEvents.filter(processingEvent => processingEvent.id === event.id).length === 0) {
      const { selectedSite, selectedArea, selectedProcess, selectedStation, selectedDevice } = this.state;
      let issueToPublish: object;
      if (!event.isActive) {
        issueToPublish = {
          id: uuid.v1(),
          eventId: event.id,
          eventDescription: event.name,
          fullEventDescription: this.getFullEventDescription(event),
          eventType: event.eventType,
          priority: event.priority,
          siteName: selectedSite.name,
          areaName: selectedArea.name,
          processName: selectedProcess.name,
          stationName: selectedStation.name,
          deviceName: selectedDevice.name,
          created: addISOTimeOffset(new Date()),
          status: 'open',
          createdBy: this.username,
          issueSource: 'webClient'
        };

        promises.push(sendMetrics({ 'issue': 1 }));
      } else {
        let issueClosedTimestamp = addISOTimeOffset(new Date());
        let resolutionTime = Math.ceil((new Date(issueClosedTimestamp).valueOf() - new Date(event.createIssueTime as string).valueOf()) / 1000);
        issueToPublish = {
          id: event.activeIssueId,
          eventId: event.id,
          eventDescription: event.name,
          eventType: event.eventType,
          priority: event.priority,
          siteName: selectedSite.name,
          areaName: selectedArea.name,
          processName: selectedProcess.name,
          stationName: selectedStation.name,
          deviceName: selectedDevice.name,
          created: event.createIssueTime,
          closed: issueClosedTimestamp,
          resolutionTime: resolutionTime,
          status: 'closed',
          expectedVersion: event.updateIssueVersion,
          closedBy: this.username
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
   * Returns the full event description that will be used when publishing the to the issue
   * notification SNS Topic. In the case of sub events, it will include the parent event name(s)
   * @param {IEvent} event - Clicked event
   * @param {string} subEventName - A string containing the descriptions of any sub events
   */
  getFullEventDescription(event: IEvent, subEventName: string = ''): string {
    let updatedSubEventName = event.name;
    if (subEventName && subEventName.trim() !== '') {
      updatedSubEventName += ` > ${subEventName.trim()}`;
    }

    if (event.parentId === event.eventProcessId) {
      return `${updatedSubEventName} (${event.description})`;
    }

    const parentEvent = this.state.events.find(e => e.id === event.parentId);
    if (parentEvent) {
      return this.getFullEventDescription(parentEvent, updatedSubEventName);
    } else {
      throw new Error('Unable to find parent event');
    }
  }

  /**
 * Set initial item
 * @param {string} keyOfItemToPopulate - the key of the item to populate
 * @param {ISelectedData[]} items - the existing items
 * @returns {ISelectedData | null} - the item to populate
 */
  getInitialSelectItem(keyOfItemToPopulate: string, items: ISelectedData[]): ISelectedData | null {
    //get query string parameter
    const search = new URLSearchParams(this.props.location.search);
    const searchedItemId = search.get(keyOfItemToPopulate.toLowerCase());
    //check if item queried for exists
    const searchedItem = items.filter((item) => item.id === searchedItemId)

    //return item to populate if there is only one item, or queried item exists
    if (items.length === 1 || searchedItem.length > 0) {
      return {
        id: searchedItem.length > 0 ? searchedItem[0].id : items[0].id,
        name: searchedItem.length > 0 ? searchedItem[0].name : items[0].name
      };
    }

    return null
  }

  /**
   * Toggles whether to show the modal containing detailed data for automated events
   * @param detailStr JSON string for the detailed data to show in the modal
   */
  toggleModal(detailStr?: string) {
    let shouldOpenModal = !this.state.showModal;

    if (shouldOpenModal) {
      try {
        const parsedDetailStr = JSON.parse(detailStr!);
        const utcDate = moment.utc(parsedDetailStr.timestamp);
        const localDate = moment.unix(utcDate.unix());

        this.setState({
          modalDiagnostics: [...parsedDetailStr.diagnostics].sort((a, b) => parseFloat(b.value) - parseFloat(a.value)),
          modalDiagnosticsMaxValue: Math.ceil(100 * Math.max(...(parsedDetailStr.diagnostics as any[]).map(d => d.value))),
          modalPredictionScore: parsedDetailStr.prediction,
          modalAnomalyDetectionTime: `${localDate.format('YYYY-MM-DD HH:mm:ss')} (${localDate.fromNow()})`
        });
      } catch (err) {
        LOGGER.error('Unable to parse anomaly detail string', err);
        shouldOpenModal = false;
      }
    } else {
      this.setState({
        modalDiagnostics: [],
        modalPredictionScore: '',
        modalAnomalyDetectionTime: ''
      });
    }

    this.setState({ showModal: shouldOpenModal });
  }

  /**
   * Checks whether the event with the supplied ID has any open sub events
   * @param eventId The ID for the root event to check
   */
  hasOpenSubEvents(eventId: string): boolean {
    const subEvents = this.state.events.filter(e => e.parentId === eventId);

    if (subEvents.length === 0) {
      return false;
    } else if (subEvents.some(e => e.isOpen)) {
      return true;
    }

    // Check if there are any child sub events that are open
    return subEvents.some(e => this.hasOpenSubEvents(e.id!));
  }

  /**
   * Checks whether the event with the supplied ID has any acknowledged sub events
   * @param eventId The ID for the root event to check
   */
  hasAcknowledgedSubEvents(eventId: string): boolean {
    const subEvents = this.state.events.filter(e => e.parentId === eventId);

    if (subEvents.length === 0) {
      return false;
    } else if (subEvents.some(e => e.isAcknowledged)) {
      return true;
    }

    // Check if there are any child sub events that are acknowledged
    return subEvents.some(e => this.hasAcknowledgedSubEvents(e.id!));
  }

  /**
   * When the Back button is clicked on the sub event modal, display sub events one level above
   * the current level. If there are no levels above the current, close the modal
   */
  clickedSubEventModalBack() {
    // Get the event that matches the `currentParentEventId`
    const currentParentEvent = this.state.events.find(e => e.id === this.state.currentParentEventId);

    if (currentParentEvent) {
      if (currentParentEvent.parentId === this.state.selectedProcess.id) {
        // Close the modal
        this.setState({ currentParentEventId: '' });
      } else {
        this.setState({ currentParentEventId: currentParentEvent.parentId! });
      }
    }
  }

  /**
   * Returns the number of sub events that match one of the statuses in the supplied array
   * @param {string} parentId The ID of the root event
   * @param {string[]} statuses The statuses to check for
   */
  getNumSubEventsWithStatus(parentId: string, statuses: string[]): number {
    const subEvents = this.state.events.filter(e => e.parentId === parentId);

    let output = 0;

    for (const subEvent of subEvents) {
      if (subEvent.isOpen && statuses.includes('open')) {
        output++;
      } else if (subEvent.isAcknowledged && statuses.includes('acknowledged')) {
        output++;
      }

      output += this.getNumSubEventsWithStatus(subEvent.id!, statuses);
    }

    return output;
  }

  /**
   * Returns the name of the event to be used as the title for it's Card. If there are open or
   * acknowledged sub events underneath, show a counter as well as the name
   * @param {IEvent} event The event for which to retrieve a formatted name
   */
  outputEventNameForCardTitle(event: IEvent): string {
    let output = event.name;

    const numOpenOrAck = this.getNumSubEventsWithStatus(event.id!, ['open', 'acknowledged']);

    if (numOpenOrAck > 0) {
      output = `${output} (${numOpenOrAck})`;
    }

    return output;
  }

  /**
   * Render this page.
   */
  render() {
    const nonAutomatedEvents = this.state.events.filter(e => e.eventType !== 'automated');

    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{I18n.get('menu.client')}</Breadcrumb.Item>
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
                        <Form.Label>{I18n.get('text.site.name')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedSite.name} onChange={this.handleSiteChange}>
                          <option data-key="" key="none-site" value="" disabled>{I18n.get('text.select.site')}</option>
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
                        <Form.Label>{I18n.get('text.area.name')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="" disabled>{I18n.get('text.select.area')}</option>
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
                        <Form.Label>{I18n.get('text.process.name')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedProcess.name} onChange={this.handleProcessChange}>
                          <option data-key="" key="none-process" value="" disabled>{I18n.get('text.select.process')}</option>
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
                        <Form.Label>{I18n.get('text.station.name')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedStation.name} onChange={this.handleStationChange}>
                          <option data-key="" key="none-station" value="" disabled>{I18n.get('text.select.station')}</option>
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
                        <Form.Label>{I18n.get('text.device.name')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedDevice.name} onChange={this.handleDeviceChange}>
                          <option data-key="" key="none-device" value="" disabled>{I18n.get('text.select.device')}</option>
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
                  <p>{I18n.get('text.no.events.for.process')}</p>
                </Jumbotron>
              }
              {
                nonAutomatedEvents.some(e => e.parentId === this.state.selectedProcess.id) &&
                <Card className="custom-card-big">
                  <Row>
                    {
                      nonAutomatedEvents
                        .filter(e => e.parentId === this.state.selectedProcess.id)
                        .map((event: IEvent) => {
                          let className = 'custom-card-event';
                          if (event.isOpen || this.hasOpenSubEvents(event.id!)) {
                            className = className.concat(' ', 'event-open');
                          } else if (event.isAcknowledged || this.hasAcknowledgedSubEvents(event.id!)) {
                            className = className.concat(' ', 'event-acknowledged');
                          } else if (event.isClosedRejected) {
                            className = className.concat(' ', 'event-closed-rejected');
                          }

                          let eventImg;
                          if (event.eventImgKey) {
                            eventImg = (
                              <div className='client-event-img-container'>
                                <AmplifyS3Image
                                  className='amplify-s3-image client-event-img'
                                  key={event.eventImgKey}
                                  imgKey={event.eventImgKey}>
                                </AmplifyS3Image>
                              </div>
                            );
                          } else {
                            eventImg = '';
                          }

                          return (
                            <Col xs={6} sm={3} md={3} key={event.id} className='custom-card-event-col'>
                              <Card className={className} onClick={async () => this.handleEventClick(event)}>
                                <Card.Body className='client-event-card-body'>
                                  <Card.Title>
                                    {this.outputEventNameForCardTitle(event)}
                                  </Card.Title>
                                  <Card.Text>
                                    {event.description}
                                  </Card.Text>
                                  {eventImg}
                                </Card.Body>
                              </Card>
                            </Col>
                          );
                        })
                    }
                  </Row>
                </Card>
              }
              {
                this.state.events.filter(e => e.eventType === 'automated').length > 0 &&
                <>
                  <hr />
                  <div className="automated-issues-heading">
                    <span className="automated-issues-heading-label">{I18n.get('text.automated.issues')}</span>
                    <OverlayTrigger
                      key="automated-issues-heading-trigger"
                      placement="right"
                      overlay={
                        <Tooltip id="automated-issues-heading-tooltip">
                          {I18n.get('text.automated.issues.description')}
                        </Tooltip>
                      }
                    >
                      <BsFillExclamationCircleFill />
                    </OverlayTrigger>

                  </div>
                  <Card className="custom-card-big">
                    <Row>
                      {
                        this.state.events.filter(e => e.eventType === 'automated').map((event: IEvent) => {
                          let className = 'custom-card-event';
                          if (event.isOpen) {
                            className = className.concat(' ', 'event-open');
                          } else if (event.isAcknowledged) {
                            className = className.concat(' ', 'event-acknowledged');
                          } else if (event.isClosedRejected) {
                            className = className.concat(' ', 'event-closed-rejected');
                          }

                          let eventImg;
                          if (event.eventImgKey) {
                            eventImg = (
                              <div className='client-event-img-container'>
                                <AmplifyS3Image
                                  className='amplify-s3-image client-event-img'
                                  key={event.eventImgKey}
                                  imgKey={event.eventImgKey}>
                                </AmplifyS3Image>
                              </div>
                            );
                          } else {
                            eventImg = '';
                          }

                          let createdText;
                          if (event.createIssueTimeUtc) {
                            const now = new Date().valueOf();
                            const dt = new Date(event.createIssueTimeUtc);
                            let relativeTime = convertSecondsToHms((now - dt.valueOf()) / 1000);
                            if (relativeTime.trim().toLowerCase() !== 'just now') {
                              relativeTime += ' ago';
                            }
                            createdText = (
                              <>
                                <br /><br />
                                <u>{I18n.get('text.created.at')}</u><br />
                                {`${dt.toDateString()} ${dt.toTimeString().split(' ')[0]}`}
                                <br />
                                {` (${relativeTime})`}
                              </>
                            );
                          } else {
                            createdText = '';
                          }

                          let viewAdditionalDetails;
                          if (event.issueAdditionalDetails) {
                            viewAdditionalDetails = (
                              <>
                                <br /><br />
                                <u onClick={() => this.toggleModal(event.issueAdditionalDetails)}>{I18n.get('button.detail')}</u><br />
                              </>
                            );
                          } else {
                            viewAdditionalDetails = '';
                          }

                          return (
                            <Col xs={6} sm={3} md={3} key={event.id} className='custom-card-event-col'>
                              <Card className={className}>
                                <Card.Body className='client-event-card-body'>
                                  <Card.Title>{event.name}</Card.Title>
                                  <Card.Text>
                                    {event.description}
                                    {createdText}
                                    {viewAdditionalDetails}
                                  </Card.Text>
                                  {eventImg}
                                </Card.Body>
                              </Card>
                            </Col>
                          );
                        })
                      }
                    </Row>
                  </Card>
                </>
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
                  <strong>{I18n.get('error')}:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
          <Modal show={this.state.showModal} onHide={this.toggleModal} size="sm">
            <Modal.Header>
              <Modal.Title>{I18n.get('text.anomaly.modal.title')}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {I18n.get('text.anomaly.detection.time')}: {this.state.modalAnomalyDetectionTime}<br />
              {I18n.get('text.anomaly.prediction.score')}: {this.state.modalPredictionScore}
              <Table striped bordered hover responsive="sm">
                <thead>
                  <tr>
                    <th key="anomaly-name-header">{I18n.get('text.anomaly.feature')}</th>
                    <th key="anomaly-value-header">{I18n.get('text.anomaly.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {this.state.modalDiagnostics
                    .map(d => {
                      return (
                        <tr key={`row-${d.name}`}>
                          <td className="anomaly-modal-name-col" key={`name-${d.name}`}>{d.name}</td>
                          <td key={`value-${d.name}`}>
                            <ProgressBar key={d.name} max={this.state.modalDiagnosticsMaxValue} variant="danger" now={parseFloat(d.value) * 100} />
                            {d.value}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </Table>
            </Modal.Body>
          </Modal>
          <Modal show={this.state.currentParentEventId !== ''} onHide={() => this.setState({ currentParentEventId: '' })} size="sm">
            <Modal.Body>
              <Row>
                <Col sm={2}>
                  <Card className="client-event-card-body sub-event-info">
                    <Card.Body>
                      {I18n.get('text.station')}: {this.state.selectedStation.name}<br />
                      {I18n.get('text.site')}: {this.state.selectedSite.name}<br />
                      {this.state.currentParentEventId !== '' && this.state.events.find(e => e.id === this.state.currentParentEventId)!.name}
                    </Card.Body>
                  </Card>
                  <Card onClick={this.clickedSubEventModalBack} className="client-event-card-body sub-event-back">
                    <Card.Body>
                      <RiArrowGoBackFill /><br />
                      {I18n.get('text.back')}
                    </Card.Body>
                  </Card>
                </Col>
                <Col>
                  <Card className="custom-card-big">
                    <CardGroup>
                      {
                        nonAutomatedEvents
                          .filter(e => e.parentId === this.state.currentParentEventId)
                          .map((event: IEvent) => {
                            let className = 'custom-card-sub-event';
                            if (event.isOpen || this.hasOpenSubEvents(event.id!)) {
                              className = className.concat(' ', 'event-open');
                            } else if (event.isAcknowledged || this.hasAcknowledgedSubEvents(event.id!)) {
                              className = className.concat(' ', 'event-acknowledged');
                            } else if (event.isClosedRejected) {
                              className = className.concat(' ', 'event-closed-rejected');
                            }

                            let eventImg;
                            if (event.eventImgKey) {
                              eventImg = (
                                <div className='client-event-img-container'>
                                  <AmplifyS3Image
                                    className='amplify-s3-image client-event-img'
                                    key={event.eventImgKey}
                                    imgKey={event.eventImgKey}>
                                  </AmplifyS3Image>
                                </div>
                              );
                            } else {
                              eventImg = '';
                            }

                            return (
                              <Col xs={6} sm={3} md={3} key={event.id} className='custom-card-event-col sub-event-card-col'>
                                <Card className={className} onClick={async () => this.handleEventClick(event)}>
                                  <Card.Body className='client-event-card-body'>
                                    <Card.Title>
                                      {this.outputEventNameForCardTitle(event)}
                                    </Card.Title>
                                    {eventImg}
                                  </Card.Body>
                                </Card>
                              </Col>
                            );
                          })
                      }
                    </CardGroup>
                  </Card>
                </Col>
              </Row>
            </Modal.Body>
          </Modal>
        </Container>
      </div>
    );
  }
}

export default Client;