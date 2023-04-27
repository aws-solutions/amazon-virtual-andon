// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation, I18n } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
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
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, sortByName, getInputFormValidationClassName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
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
  deviceAlias: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isDeviceNameValid: boolean;
  isDeviceDescriptionValid: boolean;
  isDeviceAliasValid: boolean;
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
      title: I18n.get('text.devices'),
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
      deviceAlias: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isDeviceNameValid: false,
      isDeviceDescriptionValid: false,
      isDeviceAliasValid: false
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
    this.handleDeviceAliasChange = this.handleDeviceAliasChange.bind(this);
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
      const response = await API.graphql(graphqlOperation(getStation, { id: stationId })) as GraphQLResult;
      const data: any = response.data;
      const resultData = data.getStation;

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
        title: `${I18n.get('text.devices')} (${devices.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting station', error);
      this.setState({ error: I18n.get('error.get.station') });
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

      this.props.handleNotification(I18n.get('info.delete.device'), 'success', 5);
      this.setState({
        devices: updatedDevices,
        title: `${I18n.get('text.devices')} (${updatedDevices.length})`,
        deviceId: '',
        deviceName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.device');

      const castError = error as any;

      if (castError.errors) {
        const { errorType } = castError.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while deleting device', castError);
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
      const { devices, stationId, deviceName, deviceDescription, deviceAlias, searchKeyword, sort } = this.state;
      const input = {
        deviceStationId: stationId,
        name: deviceName,
        description: deviceDescription,
        alias: deviceAlias
      };

      const response = await API.graphql(graphqlOperation(createDevice, input)) as GraphQLResult;
      const data: any = response.data;
      let newDevice: IGeneralQueryData = data.createDevice;
      newDevice.visible = searchKeyword === '' || newDevice.name.includes(searchKeyword);

      const newDevices = [...devices, newDevice];
      this.setState({
        devices: sortByName(newDevices, sort, 'name'),
        title: `${I18n.get('text.devices')} (${newDevices.length})`,
        deviceName: '',
        deviceDescription: '',
        deviceAlias: '',
        isModalProcessing: false,
        isDeviceNameValid: false,
        isDeviceDescriptionValid: false,
        isDeviceAliasValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(I18n.get('info.add.device'), 'info', 5);
      await sendMetrics({ 'device': 1 });
    } catch (error) {
      let message = I18n.get('error.create.device');

      const castError = error as any;

      if (castError.errors) {
        const { errorType } = castError.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.device.name');
        }
      }

      LOGGER.error('Error while adding device', castError);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Modal type
   * @param {string | undefined} deviceId - Device ID
   * @param {string | undefined} deviceName - Device Name
   */
  openModal(modalType: ModalType, deviceId?: string, deviceName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = I18n.get('text.device.registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.device');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
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
      deviceAlias: '',
      isDeviceNameValid: false,
      isDeviceDescriptionValid: false,
      isDeviceAliasValid: false,
      showModal: false
    });
  }

  /**
   * Handle the device name change.
   * @param {any} event - Event from the device name input
   */
  handleDeviceNameChange(event: any) {
    const deviceName = event.target.value;
    const isDeviceNameValid = validateGeneralInput(deviceName, 1, 40, '- _/#');

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
    const isDeviceDescriptionValid = validateGeneralInput(deviceDescription, 1, 40, '- _/#');

    this.setState({
      deviceDescription,
      isDeviceDescriptionValid
    });
  }

  /**
   * Handle the device alias change.
   * @param {any} event - Event from the device alias input
   */
  handleDeviceAliasChange(event: any) {
    const deviceAlias = event.target.value;
    const isDeviceAliasValid = validateGeneralInput(deviceAlias, 1, 40, '- _/#');

    this.setState({
      deviceAlias,
      isDeviceAliasValid
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
                  <Breadcrumb.Item>{I18n.get('text.sites')}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{I18n.get('text.areas')}{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/areas/${this.state.areaId}/stations`} exact>
                  <Breadcrumb.Item>{I18n.get('text.stations')}{this.state.areaName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{I18n.get('text.devices')}{this.state.stationName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{I18n.get('button.add.device')}</Button>
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
                        <Form.Label>{I18n.get('text.search.keyword')}</Form.Label>
                        <Form.Control type="text" placeholder={I18n.get('text.search.device.name')} defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{I18n.get('text.sort.by')}</Form.Label>
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
                  <p>{I18n.get('text.no.device')}</p>
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
                                <td>{I18n.get('text.description')}</td>
                                <td>{device.description}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.device.id')}</td>
                                <td>{device.id}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.device.alias')}</td>
                                <td>{device.alias}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, device.id, device.name)}>{I18n.get('button.delete')}</Button>
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
                  <strong>{I18n.get('error')}:</strong><br />
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
                    <Form.Label>{I18n.get('text.device.name')} <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={I18n.get('input.device.name')}
                      defaultValue="" onChange={this.handleDeviceNameChange} className={getInputFormValidationClassName(this.state.deviceName, this.state.isDeviceNameValid)} />
                    <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="deviceDescription">
                    <Form.Label>{I18n.get('text.device.description')} <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={I18n.get('input.device.description')}
                      defaultValue="" onChange={this.handleDeviceDescriptionChange} className={getInputFormValidationClassName(this.state.deviceDescription, this.state.isDeviceDescriptionValid)} />
                    <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="deviceAlias">
                    <Form.Label>{I18n.get('text.device.alias')}</Form.Label>
                    <Form.Control required type="text" placeholder={I18n.get('input.device.alias')}
                      defaultValue="" onChange={this.handleDeviceAliasChange} className={getInputFormValidationClassName(this.state.deviceAlias, this.state.isDeviceAliasValid)} />
                    <Form.Text className="text-muted">{`${I18n.get('info.valid.general.input')}`}</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
                <Button variant="primary" onClick={this.addDevice} disabled={this.state.isModalProcessing || !this.state.isDeviceNameValid || !this.state.isDeviceDescriptionValid}>{I18n.get('button.register')}</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                {I18n.get('text.confirm.delete.device')}: <strong>{this.state.deviceName}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
                <Button variant="danger" onClick={this.deleteDevice} disabled={this.state.isModalProcessing}>{I18n.get('button.delete')}</Button>
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