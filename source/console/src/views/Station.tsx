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
import { getArea } from '../graphql/queries';
import { createStation } from '../graphql/mutations';

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
  stations: IGeneralQueryData[];
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
  stationDescription: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isStationNameValid: boolean;
  isStationDescriptionValid: boolean;
}

// Logging
const LOGGER = new Logger('Station', LOGGING_LEVEL);

/**
 * The station page
 * @class Station
 */
class Station extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: I18n.get('text.stations'),
      stations: [],
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
      stationDescription: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isStationNameValid: false,
      isStationDescriptionValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteStation = this.deleteStation.bind(this);
    this.addStation = this.addStation.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleStationNameChange = this.handleStationNameChange.bind(this);
    this.handleStationDescriptionChange = this.handleStationDescriptionChange.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    await this.getArea();
  }

  /**
   * Get the area detail.
   */
  async getArea() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Graphql operation to get a site
      const { areaId } = this.props.match.params;
      const response = await API.graphql(graphqlOperation(getArea, { id: areaId })) as GraphQLResult;
      const data: any = response.data;
      const siteId = data.getArea.site.id;
      const siteName = `: ${data.getArea.site.name}`;
      const areaName = `: ${data.getArea.name}`;
      let stations: IGeneralQueryData[] = data.getArea.station.items;

      // Make all stations visible.
      makeAllVisible(stations);

      // Sorts initially
      stations.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        stations,
        title: `${I18n.get('text.stations')} (${stations.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting area', error);
      this.setState({ error: I18n.get('error.get.area') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete a station.
   */
  async deleteStation() {
    this.setState({ isModalProcessing: true });

    try {
      // This will delete every device belonged to the station as well.
      const { stationId } = this.state;
      await this.graphQlCommon.deleteStation(stationId);

      const updatedStations = this.state.stations.filter(station => station.id !== stationId);

      this.props.handleNotification(I18n.get('info.delete.station'), 'success', 5);
      this.setState({
        stations: updatedStations,
        title: `${I18n.get('text.stations')} (${updatedStations.length})`,
        stationId: '',
        stationName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.station');

      const castError = error as any;

      if (castError.errors) {
        const { errorType } = castError.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while deleting station', castError);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register a station.
   */
  async addStation() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register a station
      const { stations, areaId, stationName, stationDescription, searchKeyword, sort } = this.state;
      const input = {
        stationAreaId: areaId,
        name: stationName,
        description: stationDescription
      };

      const response = await API.graphql(graphqlOperation(createStation, input)) as GraphQLResult;
      const data: any = response.data;
      let newStation: IGeneralQueryData = data.createStation;
      newStation.visible = searchKeyword === '' || newStation.name.toLowerCase().includes(searchKeyword.toLowerCase());

      const newStations = [...stations, newStation]
      this.setState({
        stations: sortByName(newStations, sort, 'name'),
        title: `${I18n.get('text.stations')} (${newStations.length})`,
        stationName: '',
        stationDescription: '',
        isModalProcessing: false,
        isStationNameValid: false,
        isStationDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(I18n.get('info.add.station'), 'info', 5);
      await sendMetrics({ 'station': 1 });
    } catch (error) {
      let message = I18n.get('error.create.station');

      const castError = error as any;

      if (castError.errors) {
        const { errorType } = castError.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.station.name');
        }
      }

      LOGGER.error('Error while adding station', castError);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Modal type
   * @param {string | undefined} stationId - Station ID
   * @param {string | undefined} stationName - Station Name
   */
  openModal(modalType: ModalType, stationId?: string, stationName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = I18n.get('text.station.registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.station');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      stationId: stationId ? stationId : '',
      stationName: stationName ? stationName : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the stations result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { stations } = this.state;

    makeVisibleBySearchKeyword(stations, 'name', searchKeyword);
    this.setState({ stations, searchKeyword });
  }

  /**
   * Handle stations sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const stations = sortByName(this.state.stations, sort, 'name');

    this.setState({ stations, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      stationId: '',
      stationName: '',
      stationDescription: '',
      isStationNameValid: false,
      isStationDescriptionValid: false,
      showModal: false
    });
  }

  /**
   * Handle the station name change.
   * @param {any} event - Event from the station name input
   */
  handleStationNameChange(event: any) {
    const stationName = event.target.value;
    const isStationNameValid = validateGeneralInput(stationName, 1, 40, '- _/#');

    this.setState({
      stationName,
      isStationNameValid
    });
  }

  /**
   * Handle the station description change.
   * @param {any} event - Event from the station description input
   */
  handleStationDescriptionChange(event: any) {
    const stationDescription = event.target.value;
    const isStationDescriptionValid = validateGeneralInput(stationDescription, 1, 40, '- _/#');

    this.setState({
      stationDescription,
      isStationDescriptionValid
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
                <Breadcrumb.Item active>{I18n.get('text.stations')}{this.state.areaName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{I18n.get('button.add.station')}</Button>
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
                        <Form.Control type="text" placeholder={I18n.get('text.search.station.name')} defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
              this.state.stations.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{I18n.get('text.no.station')}</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.stations.filter((station: IGeneralQueryData) => station.visible)
                .map((station: IGeneralQueryData) => {
                  return (
                    <Col md={4} key={station.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{station.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{I18n.get('text.description')}</td>
                                <td>{station.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, station.id, station.name)}>{I18n.get('button.delete')}</Button>
                              <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/stations/${station.id}`)}>{I18n.get('button.detail')}</Button>
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
                  <Form.Group controlId="stationName">
                    <Form.Label>{I18n.get('text.station.name')} <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={I18n.get('input.station.name')}
                      defaultValue="" onChange={this.handleStationNameChange} className={getInputFormValidationClassName(this.state.stationName, this.state.isStationNameValid)} />
                    <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="stationDescription">
                    <Form.Label>{I18n.get('text.station.description')} <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={I18n.get('input.station.description')}
                      defaultValue="" onChange={this.handleStationDescriptionChange} className={getInputFormValidationClassName(this.state.stationDescription, this.state.isStationDescriptionValid)} />
                    <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
                <Button variant="primary" onClick={this.addStation} disabled={this.state.isModalProcessing || !this.state.isStationNameValid || !this.state.isStationDescriptionValid}>{I18n.get('button.register')}</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                {I18n.get('text.confirm.delete.station')}: <strong>{this.state.stationName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  {I18n.get('warning.delete.station')}
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
                <Button variant="danger" onClick={this.deleteStation} disabled={this.state.isModalProcessing}>{I18n.get('button.delete')}</Button>
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

export default Station;