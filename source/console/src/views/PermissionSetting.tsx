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
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// MobX packages
import { observable } from 'mobx';
import { observer } from 'mobx-react';

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
import { LOGGING_LEVEL, sendMetrics, sortByName, getLocaleString } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IPermission, IUser, ISelectedData, IGeneralQueryData } from '../components/Interfaces';
import { SortBy } from '../components/Enums';
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
  permissions: IPermission[];
  isLoading: boolean;
  error: string;
  user: { userId: string, username: string, version: number };
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
@observer
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
  @observable private loadedSites: {
    [key: string]: {
      siteName: string,
      areas: ISelectedData[],
      processes: ISelectedData[],
      stations: ISelectedData[],
      devices: ISelectedData[]
    }
  }

  // Private values for MobX
  @observable private sites: ISelectedData[];
  @observable private areas: ISelectedData[];
  @observable private processes: ISelectedData[];
  @observable private stations: ISelectedData[];
  @observable private devices: ISelectedData[];

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      permissions: [],
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
    this.sites = this.permission.sites ? this.permission.sites : [];
    this.areas = this.permission.areas ? this.permission.areas : [];
    this.processes = this.permission.processes ? this.permission.processes : [];
    this.stations = this.permission.stations ? this.permission.stations : [];
    this.devices = this.permission.devices ? this.permission.devices : [];
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
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // If this is an edit mode, isEmailValid is true as the previous page sends the E-Mail address.
    this.setState({ isEmailValid : this.mode === 'edit' });
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

      this.setState({ querySites });
    } catch (error) {
      LOGGER.error('Error while getting sites, areas, stations, processes and devices', error);
      this.setState({ error: getLocaleString('Error occurred while getting sites.') });
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
      this.props.handleNotification(getLocaleString('Error occurred while getting site data.'), 'error', 5);
    }

    this.loadingSites = this.loadingSites.filter(site => site !== siteId);
  }

  /**
   * Save permission.
   */
  async savePermission() {
    this.setState({ isLoading: true });

    try {
      const { user } = this.state;
      const userId = this.mode === 'add' ? user.userId : this.permission.userId;
      const version = this.mode === 'add' ? user.version : this.permission.version;

      const input = {
        userId,
        sites: this.sites,
        areas: this.areas,
        processes: this.processes,
        stations: this.stations,
        devices: this.devices,
        version: version + 1
      };

      // Graphql operation to get permissions
      await API.graphql(graphqlOperation(putPermission, { input }));
      if (this.mode === 'add') {
        this.props.handleNotification(getLocaleString('Permission was added successfully.'), 'info', 5);
        await sendMetrics({ 'permission': 1 });
      } else {
        this.props.handleNotification(getLocaleString('Permission was edited successfully.'), 'info', 5);
      }

      this.setState({ isLoading: false });
      this.props.history.push('/permissions');
    } catch (error) {
      let message = getLocaleString('Error occurred while saving the permission.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
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
  handleEmailChange(event: any) {
    const userId = event.target.value;
    this.setState({
      user: { userId, username: '', version: 0 },
      isEmailValid: userId !== ''
    });
  }

  /**
   * Handle the site change.
   * @param {any} event - Event from the site checkbox
   */
  async handleSiteChange(event: any) {
    const { id, checked } = event.target;
    const checkedSite = JSON.parse(id);
    const site = this.loadedSites[checkedSite.id];

    if (!this.loadedSites[checkedSite.id]) {
      this.props.handleNotification(getLocaleString('Site data have not been fully loaded. Please try again when the site data is loaded.'), 'warning', 5);
      return;
    }

    if (checked) {
      this.sites.push(checkedSite);
      this.areas = [...this.areas, ...site.areas];
      this.processes = [...this.processes, ...site.processes];
      this.stations = [...this.stations, ...site.stations];
      this.devices = [...this.devices, ...site.devices];
    } else {
      this.sites = this.sites.filter(site => site.id !== checkedSite.id);
      this.areas = this.areas.filter(area => area.parentId !== checkedSite.id);
      this.processes = this.processes.filter(process =>
        !site.processes.map(siteProcess => { return siteProcess.id }).includes(process.id)
      );
      this.stations = this.stations.filter(station =>
        !site.stations.map(siteStation => { return siteStation.id }).includes(station.id)
      );
      this.devices = this.devices.filter(device =>
        !site.devices.map(siteDevice => { return siteDevice.id }).includes(device.id)
      );
    }
  }

  /**
   * Handle the area change.
   * @param {any} event - Event from the area checkbox
   */
  async handleAreaChange(event: any) {
    const { id, checked } = event.target;
    const checkedArea = JSON.parse(id);
    const site = this.loadedSites[checkedArea.siteId];

    if (checked) {
      this.areas.push({ id: checkedArea.id, name: checkedArea.name, parentId: checkedArea.siteId });
      this.sites = this.getUniqueArray([...this.sites, { id: checkedArea.siteId, name: site.siteName }]);
      this.processes = [...this.processes, ...site.processes.filter(process => process.parentId === checkedArea.id)];
      this.stations = [...this.stations, ...site.stations.filter(station => station.parentId === checkedArea.id)];
      this.devices = [
        ...this.devices,
        ...site.devices.filter(device =>
          this.stations.map(station => { return station.id }).includes(device.parentId)
        )
      ];
    } else {
      this.areas = this.areas.filter(area => area.id !== checkedArea.id);
      this.sites = this.sites.filter(site =>
        this.areas.map(area => { return area.parentId }).includes(site.id)
      );
      this.processes = this.processes.filter(process => process.parentId !== checkedArea.id);
      this.stations = this.stations.filter(station => station.parentId !== checkedArea.id);
      this.devices = this.devices.filter(device =>
        this.stations.map(station => { return station.id }).includes(device.parentId)
      );
    }
  }

  /**
   * Handle the process change.
   * @param {any} event - Event from the process checkbox
   */
  handleProcessChange(event: any) {
    const { id, checked } = event.target;
    const checkedProcess = JSON.parse(id);
    const site = this.loadedSites[checkedProcess.siteId];

    if (checked) {
      this.processes.push({ id: checkedProcess.id, name: checkedProcess.name, parentId: checkedProcess.areaId });
      this.sites = this.getUniqueArray([...this.sites, { id: checkedProcess.siteId, name: site.siteName }]);
      this.areas = this.getUniqueArray([...this.areas, ...site.areas.filter(area => area.id === checkedProcess.areaId)]);
    } else {
      this.processes = this.processes.filter(process => process.id !== checkedProcess.id);
      this.areas = this.areas.filter(area =>
        this.processes.map(process => { return process.parentId }).includes(area.id) ||
        this.stations.map(station => { return station.parentId }).includes(area.id)
      );
      this.sites = this.sites.filter(site =>
        this.areas.map(area => { return area.parentId }).includes(site.id)
      );
    }
  }

  /**
   * Handle the station change.
   * @param {any} event - Event from the station checkbox
   */
  async handleStationChange(event: any) {
    const { id, checked } = event.target;
    const checkedStation = JSON.parse(id);
    const site = this.loadedSites[checkedStation.siteId];

    if (checked) {
      this.stations.push({ id: checkedStation.id, name: checkedStation.name, parentId: checkedStation.areaId });
      this.sites = this.getUniqueArray([...this.sites, { id: checkedStation.siteId, name: site.siteName }]);
      this.areas = this.getUniqueArray([...this.areas, ...site.areas.filter(area => area.id === checkedStation.areaId)]);
      this.devices = this.getUniqueArray([
        ...this.devices,
        ...site.devices.filter(device => device.parentId === checkedStation.id)
      ]);
    } else {
      this.stations = this.stations.filter(station => station.id !== checkedStation.id);
      this.areas = this.areas.filter(area =>
        this.processes.map(process => { return process.parentId }).includes(area.id) ||
        this.stations.map(station => { return station.parentId }).includes(area.id)
      );
      this.sites = this.sites.filter(site =>
        this.areas.map(area => { return area.parentId }).includes(site.id)
      );
      this.devices = this.devices.filter(device => device.parentId !== checkedStation.id);
    }
  }

  /**
   * Handle the device change.
   * @param {any} event - Event from the device checkbox
   */
  handleDeviceChange(event: any) {
    const { id, checked } = event.target;
    const checkedDevice = JSON.parse(id);
    const site = this.loadedSites[checkedDevice.siteId];

    if (checked) {
      this.devices.push({ id: checkedDevice.id, name: checkedDevice.name, parentId: checkedDevice.stationId });
      this.sites = this.getUniqueArray([...this.sites, { id: checkedDevice.siteId, name: site.siteName }]);
      this.areas = this.getUniqueArray([...this.areas, ...site.areas.filter(area => area.id === checkedDevice.areaId)]);
      this.stations = this.getUniqueArray([...this.stations, ...site.stations.filter(station => station.id === checkedDevice.stationId)]);
    } else {
      this.devices = this.devices.filter(device => device.id !== checkedDevice.id);
      this.stations = this.stations.filter(station =>
        this.devices.map(device => { return device.parentId }).includes(station.id)
      );
      this.areas = this.areas.filter(area =>
        this.processes.map(process => { return process.parentId }).includes(area.id) ||
        this.stations.map(station => { return station.parentId }).includes(area.id)
      );
      this.sites = this.sites.filter(site =>
        this.areas.map(area => { return area.parentId }).includes(site.id)
      );
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
                <LinkContainer to="/permissions" exact>
                  <Breadcrumb.Item>{ getLocaleString('Permissions') }</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ getLocaleString('Permissions Setting') }</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="secondary" onClick={() => this.props.history.push('/permissions')}>{ getLocaleString('Cancel') }</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={this.savePermission} disabled={this.state.isLoading || !this.state.isEmailValid}>{ getLocaleString('Save') }</Button>
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
                      <Form.Label column md={2}>{ getLocaleString('E-Mail') } <span className="required-field">*</span></Form.Label>
                      <Col md={10}>
                      {
                        this.mode === 'add' &&
                        <Form.Control as="select" defaultValue="" onChange={this.handleEmailChange}>
                          <option key="chooseUser" value="">{ getLocaleString('Choose User') }</option>
                          {
                            this.users.filter((user: IUser) => user.visible)
                              .map((user: IUser) => {
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
                <p>{ getLocaleString('No permission found.') }</p>
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
                            const isSiteChecked: boolean = this.sites.map(site => { return site.id }).includes(site.id as string);
                            const siteId = JSON.stringify({ id: site.id, name: site.name });

                            return (
                              <ListGroup.Item as="li" key={site.id} eventKey={site.id} onClick={() => this.getSiteData(site.id as string, site.name)}>
                                <Form.Check key={site.id} id={siteId} type="checkbox" label={site.name} onChange={this.handleSiteChange} checked={isSiteChecked} />
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
                                  <p>{ getLocaleString('No area found.') }</p>
                                </Jumbotron>
                              }
                              {
                                isSiteLoaded && loadedSite.areas.map((area: ISelectedData) => {
                                  const isAreaChecked = this.areas.map(area => { return area.id }).includes(area.id as string);
                                  const areaId = JSON.stringify({ id: area.id, name: area.name, siteId: site.id });

                                  return (
                                    <div key={area.id}>
                                      <Form.Check key={area.id} id={areaId} type="checkbox" label={ `${getLocaleString('Area')}: ${area.name}`} onChange={this.handleAreaChange} checked={isAreaChecked} />
                                      <Table>
                                        <thead>
                                          <tr>
                                            <th>{ getLocaleString('Processes') }</th>
                                            <th>{ getLocaleString('Stations') }</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr>
                                            <td className="table-align-top">
                                            {
                                              loadedSite.processes.filter((process: ISelectedData) => process.parentId === area.id)
                                                .map((process: ISelectedData) => {
                                                  const isProcessChecked = this.processes.map(process => { return process.id }).includes(process.id as string);
                                                  const processId = JSON.stringify({ id: process.id, name: process.name, siteId: site.id, areaId: area.id });

                                                  return (
                                                    <Form.Check key={process.id} id={processId} type="checkbox" label={process.name} onChange={this.handleProcessChange} checked={isProcessChecked} />
                                                  );
                                                })
                                            }
                                            </td>
                                            <td className="table-align-top">
                                            {
                                              loadedSite.stations.filter((station: ISelectedData) => station.parentId === area.id)
                                                .map((station: ISelectedData) => {
                                                  const isStationChecked = this.stations.map(station => { return station.id }).includes(station.id as string);
                                                  const stationId = JSON.stringify({ id: station.id, name: station.name, siteId: site.id, areaId: area.id });

                                                  return (
                                                    <div key={station.id}>
                                                      <Form.Check key={station.id} id={stationId} type="checkbox" label={station.name} onChange={this.handleStationChange} checked={isStationChecked} />
                                                      <Table>
                                                        <tbody>
                                                          <tr>
                                                            <td className="table-align-top">
                                                            {
                                                              loadedSite.devices.filter((device: ISelectedData) => device.parentId === station.id)
                                                                .map((device: ISelectedData) => {
                                                                  const isDeviceChecked = this.devices.map(device => { return device.id }).includes(device.id as string);
                                                                  const deviceId = JSON.stringify({ id: device.id, name: device.name, siteId: site.id, areaId: area.id, stationId: station.id });

                                                                  return (
                                                                    <Form.Check key={device.id} id={deviceId} type="checkbox" label={device.name} onChange={this.handleDeviceChange} checked={isDeviceChecked} />
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

export default PermissionSetting;