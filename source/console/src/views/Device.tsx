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
import Modal from 'react-bootstrap/Modal';

// Import graphql
import { getStation } from '../graphql/queries';
import { createDevice } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, sortByName, getLocaleString, getInputFormValidationClassName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData } from '../components/Interfaces';
import { ModalType, SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
  match?: any;
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  title: string;
  devices: IGeneralQueryData[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  stationId: string;
  stationName: string;
  deviceId: string;
  deviceName: string;
  deviceDescription: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isDeviceNameValid: boolean;
  isDeviceDescriptionValid: boolean;
}

// Logging
const LOGGER = new Logger('Device', LOGGING_LEVEL);

/**
 * The device page
 * @class Device
 */
class Device extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: getLocaleString('Devices'),
      devices: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      stationId: '',
      stationName: '',
      deviceId: '',
      deviceName: '',
      deviceDescription: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isDeviceNameValid: false,
      isDeviceDescriptionValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteDevice = this.deleteDevice.bind(this);
    this.addDevice = this.addDevice.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleDeviceNameChange = this.handleDeviceNameChange.bind(this);
    this.handleDeviceDescriptionChange = this.handleDeviceDescriptionChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    await this.getStation();
  }

  /**
   * Get the station detail.
   */
  async getStation() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Graphql operation to get a site
      const { stationId } = this.props.match.params;
      const response = await API.graphql(graphqlOperation(getStation, { id: stationId }));
      const resultData = response.data.getStation;

      const siteId = resultData.area.site.id;
      const siteName = `: ${resultData.area.site.name}`;
      const areaId = resultData.area.id;
      const areaName = `: ${resultData.area.name}`;
      let devices: IGeneralQueryData[] = resultData.device.items;

      // Make all devices visible.
      makeAllVisible(devices);

      // Sorts initially
      devices.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        stationId,
        devices,
        title: `${getLocaleString('Devices')} (${devices.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting station', error);
      this.setState({ error: getLocaleString('Error occurred while getting a station.')});
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete a device.
   */
  async deleteDevice() {
    this.setState({ isModalProcessing: true });

    try {
      const { deviceId } = this.state;
      await this.graphQlCommon.deleteDevice(deviceId);

      const updatedDevices = this.state.devices.filter(device => device.id !== deviceId);

      this.props.handleNotification(getLocaleString('Device was deleted successfully.'), 'success', 5);
      this.setState({
        devices: updatedDevices,
        title: `${getLocaleString('Devices')} (${updatedDevices.length})`,
        deviceId: '',
        deviceName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the device.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error while deleting device', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register a device.
   */
  async addDevice() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register a device
      const { devices, stationId, deviceName, deviceDescription, searchKeyword, sort } = this.state;
      const input = {
        deviceStationId: stationId,
        name: deviceName,
        description: deviceDescription,
        __typename: 'Device'
      };

      const response = await API.graphql(graphqlOperation(createDevice, input));
      let newDevice: IGeneralQueryData = response.data.createDevice;
      newDevice.visible = searchKeyword === '' || newDevice.name.includes(searchKeyword);

      const newDevices = [...devices, newDevice];
      this.setState({
        devices: sortByName(newDevices, sort, 'name'),
        title: `${getLocaleString('Devices')} (${newDevices.length})`,
        deviceName: '',
        deviceDescription: '',
        isModalProcessing: false,
        isDeviceNameValid: false,
        isDeviceDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('Device was added successfully.'), 'info', 5);
      await sendMetrics({ 'device': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while creating a device.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'DataDuplicatedError') {
          message = getLocaleString('Device name already exists.');
        }
      }

      LOGGER.error('Error while adding device', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} deviceId - Device ID
   * @param {string | undefined} deviceName - Device Name
   */
  openModal(modalType: ModalType, deviceId?: string, deviceName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Device Registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete Device');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      deviceId: deviceId ? deviceId : '',
      deviceName: deviceName ? deviceName : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the devices result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { devices } = this.state;

    makeVisibleBySearchKeyword(devices, 'name', searchKeyword);
    this.setState({ devices, searchKeyword });
  }

  /**
   * Handle devices sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const devices = sortByName(this.state.devices, sort, 'name');

    this.setState({ devices, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      deviceId: '',
      deviceName: '',
      deviceDescription: '',
      isDeviceNameValid: false,
      isDeviceDescriptionValid: false,
      showModal: false
    });
  }

  /**
   * Handle the device name change.
   * @param {any} event - Event from the device name input
   */
  handleDeviceNameChange(event: any) {
    const deviceName = event.target.value;
    const isDeviceNameValid = validateGeneralInput(deviceName);

    this.setState({
      deviceName,
      isDeviceNameValid
    });
  }

  /**
   * Handle the device description change.
   * @param {any} event - Event from the device description input
   */
  handleDeviceDescriptionChange(event: any) {
    const deviceDescription = event.target.value;
    const isDeviceDescriptionValid = validateGeneralInput(deviceDescription);

    this.setState({
      deviceDescription,
      isDeviceDescriptionValid
    });
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
                <LinkContainer to="/sites" exact>
                  <Breadcrumb.Item>{ getLocaleString('Sites') }</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{ getLocaleString('Areas') }{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/areas/${this.state.areaId}/stations`} exact>
                  <Breadcrumb.Item>{ getLocaleString('Stations') }{this.state.areaName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ getLocaleString('Devices') }{this.state.stationName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add Device') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>{this.state.title}</Card.Title>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} md={4} controlId="searchKeyword">
                        <Form.Label>{ getLocaleString('Search Keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ getLocaleString('Search by Device Name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{ getLocaleString('Sort By') }</Form.Label>
                        <Form.Control as="select" defaultValue={this.state.sort} onChange={this.handleSort}>
                          <option value={SortBy.Asc}>A-Z</option>
                          <option value={SortBy.Desc}>Z-A</option>
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
            {
              this.state.devices.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ getLocaleString('No device found.') }</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.devices.filter((device: IGeneralQueryData) => device.visible)
                .map((device: IGeneralQueryData) => {
                  return (
                    <Col md={4} key={device.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{device.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{ getLocaleString('Description') }</td>
                                <td>{device.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, device.id, device.name)}>{ getLocaleString('Delete') }</Button>
                            </Form.Row>
                          </Form>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })
            }
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
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{this.state.modalTitle}</Modal.Title>
          </Modal.Header>
          {
            this.state.modalType === ModalType.Add &&
            <div>
              <Modal.Body>
                <Form>
                  <Form.Group controlId="deviceName">
                    <Form.Label>{ getLocaleString('Device Name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the device name') }
                      defaultValue="" onChange={this.handleDeviceNameChange} className={ getInputFormValidationClassName(this.state.deviceName, this.state.isDeviceNameValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="deviceDescription">
                    <Form.Label>{ getLocaleString('Device Description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the device description') }
                      defaultValue="" onChange={this.handleDeviceDescriptionChange} className={ getInputFormValidationClassName(this.state.deviceDescription, this.state.isDeviceDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addDevice} disabled={this.state.isModalProcessing || !this.state.isDeviceNameValid || !this.state.isDeviceDescriptionValid}>{ getLocaleString('Register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this device') }: <strong>{this.state.deviceName}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteDevice} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.isModalProcessing &&
            <ProgressBar animated now={100} />
          }
        </Modal>
      </div>
    );
  }
}

export default Device;