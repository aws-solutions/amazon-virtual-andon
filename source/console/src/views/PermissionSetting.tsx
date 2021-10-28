// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation, I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Table from 'react-bootstrap/Table';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Alert from 'react-bootstrap/Alert';
import Tab from 'react-bootstrap/Tab';
import ListGroup from 'react-bootstrap/ListGroup';
import Spinner from 'react-bootstrap/Spinner';

// Import graphql
import { putPermission } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, sortByName } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IPermission, IUser, ISelectedData, IGeneralQueryData, ISiteData } from '../components/Interfaces';
import { SortBy, AVAPermissionTypes } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';
import EmptyCol from '../components/EmptyCol';

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
  isLoading: boolean;
  error: string;
  user: { userId: string, username: string, version: number };
  userPermissions?: IPermission;
  querySites: ISelectedData[];
  isEmailValid: boolean;
}

// Logging
const LOGGER = new Logger('PermissionSetting', LOGGING_LEVEL);

// Init user
const INIT_USER = { userId: '', username: '', version: 0 };

/**
 * The permission setting page
 * @class PermissionSetting
 */
// @observer
class PermissionSetting extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Setting mode
  private mode: string;
  // Users
  private users: IUser[];
  // User permission
  private permission: IPermission;
  // Sites that are currently loading data
  private loadingSites: string[];
  // Sites that have been loaded
  private loadedSites: {
    [key: string]: ISiteData;
  }

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      isLoading: false,
      error: '',
      user: INIT_USER,
      querySites: [],
      isEmailValid: false
    };

    const avaPermissionMode = localStorage.getItem('ava_permission_mode');
    const avaPermission = localStorage.getItem('ava_permission');
    const avaUsers = localStorage.getItem('ava_users');

    this.users = avaUsers ? JSON.parse(Buffer.from(avaUsers, 'base64').toString()) : [];
    this.mode = avaPermissionMode ? avaPermissionMode : 'add';
    this.permission = avaPermission ? JSON.parse(avaPermission) : {};
    this.loadingSites = [];
    this.loadedSites = {};
    this.graphQlCommon = new GraphQLCommon();

    this.getSites = this.getSites.bind(this);
    this.getSiteData = this.getSiteData.bind(this);
    this.savePermission = this.savePermission.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.handleProcessChange = this.handleProcessChange.bind(this);
    this.handleStationChange = this.handleStationChange.bind(this);
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
    this.toggleUserPermission = this.toggleUserPermission.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // If this is an edit mode, isEmailValid is true as the previous page sends the E-Mail address.
    const userId = this.permission.id ? this.permission.id : '';
    if (this.mode === 'edit') {
      this.setState({
        isEmailValid: true,
        user: {
          userId,
          username: '',
          version: 0
        },
        userPermissions: await this.getPermissionsForUserId(userId),
      });
    } else {
      this.setState({ isEmailValid: false });
    }
    await this.getSites();
  }

  /**
   * Get sites.
   */
  async getSites() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      let querySites: ISelectedData[] = [];

      // Sites
      const sites: IGeneralQueryData[] = await this.graphQlCommon.listSites();
      querySites = sites.map((site: IGeneralQueryData) => { return { id: site.id, name: site.name } });
      querySites = sortByName(querySites, SortBy.Asc, 'name');

      for (const site of sites) {
        if (site.id) {
          await this.getSiteData(site.id, site.name);
        }
      }

      this.setState({ querySites });
    } catch (error) {
      LOGGER.error('Error while getting sites, areas, stations, processes and devices', error);
      this.setState({ error: I18n.get('error.get.sites') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get all site data including areas, processes, stations, and devices.
   */
  async getSiteData(siteId: string, siteName: string) {
    if (this.loadingSites.includes(siteId) || this.loadedSites.siteId) {
      return;
    }

    this.loadingSites.push(siteId);

    try {
      let queryAreas: ISelectedData[] = [];
      let queryProcesses: ISelectedData[] = [];
      let queryStations: ISelectedData[] = [];
      let queryDevices: ISelectedData[] = [];

      // Areas
      const areas: IGeneralQueryData[] = await this.graphQlCommon.listAreas(siteId);
      queryAreas = areas.map((area: IGeneralQueryData) => { return { id: area.id, name: area.name, parentId: siteId } });
      queryAreas = sortByName(queryAreas, SortBy.Asc, 'name');

      // Processes and stations
      for (let area of queryAreas) {
        const processes: IGeneralQueryData[] = await this.graphQlCommon.listProcesses(area.id as string);
        queryProcesses = [...queryProcesses, ...processes.map((process: IGeneralQueryData) => { return { id: process.id, name: process.name, parentId: area.id } })];

        const stations: IGeneralQueryData[] = await this.graphQlCommon.listStations(area.id as string);
        queryStations = [...queryStations, ...stations.map((station: IGeneralQueryData) => { return { id: station.id, name: station.name, parentId: area.id } })];
      }
      queryProcesses = sortByName(queryProcesses, SortBy.Asc, 'name');
      queryStations = sortByName(queryStations, SortBy.Asc, 'name');

      // Devices
      for (let station of queryStations) {
        const devices: IGeneralQueryData[] = await this.graphQlCommon.listDevices(station.id as string);
        queryDevices = [...queryDevices, ...devices.map((device: IGeneralQueryData) => { return { id: device.id, name: device.name, parentId: station.id } })];
      }
      queryDevices = sortByName(queryDevices, SortBy.Asc, 'name');

      this.loadedSites[siteId] = {
        siteName: siteName,
        areas: queryAreas,
        processes: queryProcesses,
        stations: queryStations,
        devices: queryDevices
      };
    } catch (error) {
      LOGGER.error('Error while getting site data', error);
      this.props.handleNotification(I18n.get('error.get.site.data'), 'error', 5);
    }

    this.loadingSites = this.loadingSites.filter(site => site !== siteId);
  }

  /**
   * Save permission.
   */
  async savePermission() {
    if (!this.state.userPermissions) { return; }
    this.setState({ isLoading: true });

    try {
      const input = {
        id: this.state.userPermissions.id,
        sites: this.state.userPermissions.sites,
        areas: this.state.userPermissions.areas,
        processes: this.state.userPermissions.processes,
        stations: this.state.userPermissions.stations,
        devices: this.state.userPermissions.devices,
        version: this.state.userPermissions.version + 1
      };

      // Graphql operation to get permissions
      await API.graphql(graphqlOperation(putPermission, { input }));
      if (this.mode === 'add') {
        this.props.handleNotification(I18n.get('info.add.permission'), 'info', 5);
        await sendMetrics({ 'permission': 1 });
      } else {
        this.props.handleNotification(I18n.get('info.edit.permission'), 'info', 5);
      }

      this.setState({ isLoading: false });
      this.props.history.push('/permissions');
    } catch (error) {
      let message = I18n.get('error.save.permission');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while saving permission', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isLoading: false });
    }
  }

  /**
   * Get unique array from the provided array.
   * @param {ISelectedData[]} array - Array to get unique object values
   * @return {ISelectedData[]} Unique array
   */
  getUniqueArray(array: ISelectedData[]): ISelectedData[] {
    return array.filter((foo, index, self) => self.findIndex(bar => bar.id === foo.id) === index);
  }

  /**
   * Handle the user E-Mail change.
   * @param {any} event - Event from the E-Mail select
   */
  async handleEmailChange(event: any) {
    this.setState({ isLoading: true });

    const userId = event.target.value;

    let userPermissions = await this.getPermissionsForUserId(userId);

    // If the `userId` is valid but no permissions were returned, create a default `userPermissions` object
    if (!userPermissions && userId && userId.trim() !== '') {
      userPermissions = {
        id: userId,
        username: '',
        version: 1,
        areas: [],
        devices: [],
        processes: [],
        stations: [],
        sites: [],
        visible: true
      };
    }

    this.setState({
      user: { userId, username: '', version: 0 },
      isEmailValid: userId !== '',
      userPermissions,
      isLoading: false
    });
  }

  /**
   * Returns the permissions for the supplied user ID
   */
  async getPermissionsForUserId(userId: string): Promise<IPermission | undefined> {
    try {
      if (userId && userId.trim() !== '') {
        const permissions = await this.graphQlCommon.listPermissions();
        return permissions.find(permission => permission.id === userId);
      }
    } catch (err) {
      console.error(err);
    }

    return undefined;
  }

  /**
   * Handle the site change.
   * @param {any} event - Event from the site checkbox
   */
  async handleSiteChange(event: any) {
    const { id } = event.target;
    const checkedSite = JSON.parse(id);
    const siteData = this.loadedSites[checkedSite.id];

    if (!siteData) {
      this.props.handleNotification(I18n.get('error.site.not.loaded'), 'warning', 5);
      return;
    }

    const userPermissions = this.state.userPermissions;
    const permissionSiteIdx = userPermissions ? userPermissions.sites.findIndex(s => s.id === checkedSite.id) : -1;
    const shouldEnablePermission = (permissionSiteIdx === -1);

    this.toggleUserPermission(AVAPermissionTypes.Site, checkedSite.id, shouldEnablePermission, siteData);
  }

  /**
   * Handle the area change.
   * @param {any} event - Event from the area checkbox
   */
  async handleAreaChange(event: any) {
    const { id } = event.target;
    const checkedArea = JSON.parse(id);
    const siteData = this.loadedSites[checkedArea.siteId];

    const userPermissions = this.state.userPermissions;
    const permissionIdx = userPermissions ? userPermissions.areas.findIndex(x => x.id === checkedArea.id) : -1;
    const shouldEnablePermission = (permissionIdx === -1);

    this.toggleUserPermission(AVAPermissionTypes.Area, checkedArea.id, shouldEnablePermission, siteData);
  }

  toggleUserPermission(type: AVAPermissionTypes, id: string, permissionEnabled: boolean, siteData: ISiteData) {
    const userPermissions = this.state.userPermissions;

    if (userPermissions) {
      switch (type) {
        case AVAPermissionTypes.Site:
          if (permissionEnabled) {
            userPermissions.areas.push(...siteData.areas);
            userPermissions.processes.push(...siteData.processes);
            userPermissions.stations.push(...siteData.stations);
            userPermissions.devices.push(...siteData.devices);
            userPermissions.sites.push({ id, name: siteData.siteName });
          } else {
            siteData.areas.forEach(x => userPermissions.areas = userPermissions.areas.filter(y => y.id !== x.id));
            siteData.processes.forEach(x => userPermissions.processes = userPermissions.processes.filter(y => y.id !== x.id));
            siteData.stations.forEach(x => userPermissions.stations = userPermissions.stations.filter(y => y.id !== x.id));
            siteData.devices.forEach(x => userPermissions.devices = userPermissions.devices.filter(y => y.id !== x.id));
            userPermissions.sites = userPermissions.sites.filter(y => y.id !== id);
          }
          break;
        case AVAPermissionTypes.Area:
          const area = siteData.areas.find(a => a.id === id)!;

          if (permissionEnabled) {
            userPermissions.sites.push({ id: area.parentId!, name: siteData.siteName });
            userPermissions.areas.push(area);
            userPermissions.processes.push(...siteData.processes.filter(p => p.parentId === id));
            siteData.stations
              .filter(s => s.parentId === id)
              .forEach(s => {
                userPermissions.stations.push(s);
                userPermissions.devices.push(...siteData.devices.filter(d => d.parentId === s.id));
              });
          } else {
            userPermissions.areas = userPermissions.areas.filter(a => a.id !== id);
            userPermissions.processes = userPermissions.processes.filter(p => p.parentId !== id);
            userPermissions.stations = userPermissions.stations.filter(s => s.parentId !== id);

            // Filter out any device that belongs to a station under the area that was unchecked
            userPermissions.devices = userPermissions.devices.filter(d => {
              const stationWithDevice = siteData.stations.find(s => s.id === d.parentId);
              if (stationWithDevice) {
                return stationWithDevice.parentId !== id;
              }

              return true;
            });
          }
          break;
        case AVAPermissionTypes.Process:
          const process = siteData.processes.find(p => p.id === id)!;
          const processArea = siteData.areas.find(a => a.id === process.parentId)!;
          if (permissionEnabled) {
            userPermissions.processes.push(process);
            userPermissions.areas.push(processArea);
            userPermissions.sites.push({ id: processArea.parentId!, name: siteData.siteName });
          } else {
            userPermissions.processes = userPermissions.processes.filter(p => p.id !== id);
          }
          break;
        case AVAPermissionTypes.Station:
          const station = siteData.stations.find(s => s.id === id)!;
          const stationArea = siteData.areas.find(a => a.id === station.parentId)!;

          if (permissionEnabled) {
            userPermissions.stations.push(station);
            userPermissions.areas.push(stationArea);
            userPermissions.sites.push({ id: stationArea.parentId!, name: siteData.siteName });
            userPermissions.devices.push(...siteData.devices.filter(d => d.parentId === id));
          } else {
            userPermissions.devices = userPermissions.devices.filter(d => d.parentId !== id);
            userPermissions.stations = userPermissions.stations.filter(s => s.id !== id);
          }
          break;
        case AVAPermissionTypes.Device:
          const device = siteData.devices.find(d => d.id === id)!;
          const deviceStation = siteData.stations.find(s => s.id === device.parentId)!;
          const deviceArea = siteData.areas.find(a => a.id === deviceStation.parentId)!;
          if (permissionEnabled) {
            userPermissions.devices.push(device);
            userPermissions.stations.push(deviceStation);
            userPermissions.areas.push(deviceArea);
            userPermissions.sites.push({ id: deviceArea.parentId!, name: siteData.siteName });
          } else {
            userPermissions.devices = userPermissions.devices.filter(d => d.id !== id);
          }
          break;
      }

      // Remove a station permission if there are no devices enabled
      const stationsIdsToRemove = userPermissions.stations.filter(s => {
        return !userPermissions.devices.some(d => d.parentId === s.id);
      }).map(s => s.id);

      stationsIdsToRemove.forEach(stationId => {
        userPermissions.stations = userPermissions.stations.filter(s => s.id !== stationId);
      });

      // Remove an area permission if there are no stations or processes enabled
      const areaIdsToRemove = userPermissions.areas.filter(a => {
        return ![...userPermissions.stations, ...userPermissions.processes].some(x => x.parentId === a.id);
      }).map(a => a.id);

      areaIdsToRemove.forEach(areaId => {
        userPermissions.areas = userPermissions.areas.filter(a => a.id !== areaId);
      });

      // Remove a site permission if there are no areas enabled
      const siteIdsToRemove = userPermissions.sites.filter(s => {
        return !userPermissions.areas.some(a => a.parentId === s.id);
      }).map(s => s.id);

      siteIdsToRemove.forEach(siteId => {
        userPermissions.sites = userPermissions.sites.filter(s => s.id !== siteId);
      });

      this.setState({
        userPermissions: {
          id: userPermissions.id,
          username: userPermissions.username,
          sites: this.getUniqueArray(userPermissions.sites),
          areas: this.getUniqueArray(userPermissions.areas),
          processes: this.getUniqueArray(userPermissions.processes),
          stations: this.getUniqueArray(userPermissions.stations),
          devices: this.getUniqueArray(userPermissions.devices),
          version: userPermissions.version
        }
      });
    }
  }

  /**
   * Handle the process change.
   * @param {any} event - Event from the process checkbox
   */
  handleProcessChange(event: any) {
    const { id } = event.target;
    const checkedProcess = JSON.parse(id);
    const siteData = this.loadedSites[checkedProcess.siteId];

    const userPermissions = this.state.userPermissions;
    const permissionIdx = userPermissions ? userPermissions.processes.findIndex(x => x.id === checkedProcess.id) : -1;
    const shouldEnablePermission = (permissionIdx === -1);

    this.toggleUserPermission(AVAPermissionTypes.Process, checkedProcess.id, shouldEnablePermission, siteData);
  }

  /**
   * Handle the station change.
   * @param {any} event - Event from the station checkbox
   */
  async handleStationChange(event: any) {
    const { id } = event.target;
    const checkedStation = JSON.parse(id);
    const siteData = this.loadedSites[checkedStation.siteId];

    const userPermissions = this.state.userPermissions;
    const permissionIdx = userPermissions ? userPermissions.stations.findIndex(x => x.id === checkedStation.id) : -1;
    const shouldEnablePermission = (permissionIdx === -1);

    this.toggleUserPermission(AVAPermissionTypes.Station, checkedStation.id, shouldEnablePermission, siteData);
  }

  /**
   * Handle the device change.
   * @param {any} event - Event from the device checkbox
   */
  handleDeviceChange(event: any) {
    const { id } = event.target;
    const checkedDevice = JSON.parse(id);
    const siteData = this.loadedSites[checkedDevice.siteId];

    const userPermissions = this.state.userPermissions;
    const permissionIdx = userPermissions ? userPermissions.devices.findIndex(x => x.id === checkedDevice.id) : -1;
    const shouldEnablePermission = (permissionIdx === -1);

    this.toggleUserPermission(AVAPermissionTypes.Device, checkedDevice.id, shouldEnablePermission, siteData);
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
                <LinkContainer to="/permissions" exact>
                  <Breadcrumb.Item>{I18n.get('text.permissions')}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{I18n.get('text.permissions.setting')}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="secondary" onClick={() => this.props.history.push('/permissions')}>{I18n.get('button.cancel')}</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={this.savePermission} disabled={this.state.isLoading || !this.state.isEmailValid}>{I18n.get('button.save')}</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Form>
                    <Form.Group controlId="username" as={Row}>
                      <Form.Label column md={2}>{I18n.get('text.email')} <span className="required-field">*</span></Form.Label>
                      <Col md={10}>
                        {
                          this.mode === 'add' &&
                          <Form.Control as="select" defaultValue="" onChange={this.handleEmailChange}>
                            <option key="chooseUser" value="">{I18n.get('text.choose.user')}</option>
                            {
                              this.users.map((user: IUser) => {
                                return (
                                  <option key={user.userId} value={user.userId}>{user.username}</option>
                                )
                              })
                            }
                          </Form.Control>
                        }
                        {
                          this.mode === 'edit' &&
                          <Form.Control type="text" defaultValue={this.permission.username} disabled />
                        }
                      </Col>
                    </Form.Group>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              {
                this.state.querySites.length === 0 && !this.state.isLoading &&
                <Jumbotron>
                  <p>{I18n.get('text.no.permission')}</p>
                </Jumbotron>
              }
              {
                this.state.querySites.length > 0 &&
                <Card className="custom-card-big">
                  <Card.Body>
                    <Tab.Container id="site-tabs">
                      <Row>
                        <Col sm={3}>
                          <ListGroup as="ul">
                            {
                              this.state.querySites.map((site: ISelectedData) => {
                                let hasSitePermission = false;
                                if (this.state.userPermissions) {
                                  hasSitePermission = this.state.userPermissions.sites.some(s => s.id === site.id);
                                }

                                return (
                                  <ListGroup.Item as="li" key={site.id} eventKey={site.id}>
                                    <Form.Check key={site.id} id={JSON.stringify({ id: site.id, name: site.name })} type="checkbox" label={site.name} onChange={this.handleSiteChange} checked={hasSitePermission} />
                                  </ListGroup.Item>
                                );
                              })
                            }
                          </ListGroup>
                        </Col>
                        <Col sm={9}>
                          <Tab.Content>
                            {
                              this.state.querySites.map((site: ISelectedData) => {
                                const loadedSite = this.loadedSites[site.id as string];
                                const isSiteLoaded: boolean = loadedSite !== undefined;

                                return (
                                  <Tab.Pane key={site.id} eventKey={site.id}>
                                    {
                                      !isSiteLoaded &&
                                      <Spinner animation="border" />
                                    }
                                    {
                                      isSiteLoaded && loadedSite.areas.length === 0 &&
                                      <Jumbotron>
                                        <p>{I18n.get('text.no.area')}</p>
                                      </Jumbotron>
                                    }
                                    {
                                      isSiteLoaded && loadedSite.areas.map((area: ISelectedData) => {
                                        let hasPermission = false;
                                        if (this.state.userPermissions) {
                                          hasPermission = this.state.userPermissions.areas.some(x => x.id === area.id);
                                        }

                                        return (
                                          <div key={area.id}>
                                            <Form.Check key={area.id} id={JSON.stringify({ id: area.id, name: area.name, siteId: site.id })} type="checkbox" label={`${I18n.get('text.area')}: ${area.name}`} onChange={this.handleAreaChange} checked={hasPermission} />
                                            <Table>
                                              <thead>
                                                <tr>
                                                  <th>{I18n.get('info.processes')}</th>
                                                  <th>{I18n.get('text.stations')}</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                <tr>
                                                  <td className="table-align-top">
                                                    {
                                                      loadedSite.processes.filter((process: ISelectedData) => process.parentId === area.id)
                                                        .map((process: ISelectedData) => {
                                                          const processId = JSON.stringify({ id: process.id, name: process.name, siteId: site.id, areaId: area.id });
                                                          let hasProcessPermission = false;
                                                          if (this.state.userPermissions) {
                                                            hasProcessPermission = this.state.userPermissions.processes.some(x => x.id === process.id);
                                                          }

                                                          return (
                                                            <Form.Check key={process.id} id={processId} type="checkbox" label={process.name} onChange={this.handleProcessChange} checked={hasProcessPermission} />
                                                          );
                                                        })
                                                    }
                                                  </td>
                                                  <td className="table-align-top">
                                                    {
                                                      loadedSite.stations.filter((station: ISelectedData) => station.parentId === area.id)
                                                        .map((station: ISelectedData) => {
                                                          const stationId = JSON.stringify({ id: station.id, name: station.name, siteId: site.id, areaId: area.id });
                                                          let hasStationPermission = false;
                                                          if (this.state.userPermissions) {
                                                            hasStationPermission = this.state.userPermissions.stations.some(x => x.id === station.id);
                                                          }

                                                          return (
                                                            <div key={station.id}>
                                                              <Form.Check key={station.id} id={stationId} type="checkbox" label={station.name} onChange={this.handleStationChange} checked={hasStationPermission} />
                                                              <Table>
                                                                <tbody>
                                                                  <tr>
                                                                    <td className="table-align-top">
                                                                      {
                                                                        loadedSite.devices.filter((device: ISelectedData) => device.parentId === station.id)
                                                                          .map((device: ISelectedData) => {
                                                                            const deviceId = JSON.stringify({ id: device.id, name: device.name, siteId: site.id, areaId: area.id, stationId: station.id });
                                                                            let hasDevicePermission = false;
                                                                            if (this.state.userPermissions) {
                                                                              hasDevicePermission = this.state.userPermissions.devices.some(x => x.id === device.id);
                                                                            }

                                                                            return (
                                                                              <Form.Check key={device.id} id={deviceId} type="checkbox" label={device.name} onChange={this.handleDeviceChange} checked={hasDevicePermission} />
                                                                            );
                                                                          })
                                                                      }
                                                                    </td>
                                                                  </tr>
                                                                </tbody>
                                                              </Table>
                                                            </div>
                                                          );
                                                        })
                                                    }
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </Table>
                                          </div>
                                        );
                                      })
                                    }
                                  </Tab.Pane>
                                );
                              })
                            }
                          </Tab.Content>
                        </Col>
                      </Row>
                    </Tab.Container>
                  </Card.Body>
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
                  <strong>{I18n.get('error')}:</strong><br />
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

export default PermissionSetting;