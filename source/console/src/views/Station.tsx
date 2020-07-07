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
import { getArea } from '../graphql/queries';
import { createStation } from '../graphql/mutations';

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
      title: getLocaleString('Stations'),
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
      const response = await API.graphql(graphqlOperation(getArea, { id: areaId }));
      const siteId = response.data.getArea.site.id;
      const siteName = `: ${response.data.getArea.site.name}`;
      const areaName = `: ${response.data.getArea.name}`;
      let stations: IGeneralQueryData[] = response.data.getArea.station.items;

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
        title: `${getLocaleString('Stations')} (${stations.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting area', error);
      this.setState({ error: getLocaleString('Error occurred while getting an area.') });
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

      this.props.handleNotification(getLocaleString('Station was deleted successfully.'), 'success', 5);
      this.setState({
        stations: updatedStations,
        title: `${getLocaleString('Stations')} (${updatedStations.length})`,
        stationId: '',
        stationName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the station.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error while deleting station', error);
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
        description: stationDescription,
        __typename: 'Station'
      };

      const response = await API.graphql(graphqlOperation(createStation, input));
      let newStation: IGeneralQueryData = response.data.createStation;
      newStation.visible = searchKeyword === '' || newStation.name.toLowerCase().includes(searchKeyword.toLowerCase());

      const newStations = [...stations, newStation]
      this.setState({
        stations: sortByName(newStations, sort, 'name'),
        title: `${getLocaleString('Stations')} (${newStations.length})`,
        stationName: '',
        stationDescription: '',
        isModalProcessing: false,
        isStationNameValid: false,
        isStationDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('Station was added successfully.'), 'info', 5);
      await sendMetrics({ 'station': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while creating a station.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'DataDuplicatedError') {
          message = getLocaleString('Station name already exists.');
        }
      }

      LOGGER.error('Error while adding station', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} stationId - Station ID
   * @param {string | undefined} stationName - Station Name
   */
  openModal(modalType: ModalType, stationId?: string, stationName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Station Registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete Station');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
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
    const isStationNameValid = validateGeneralInput(stationName);

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
    const isStationDescriptionValid = validateGeneralInput(stationDescription);

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
                  <Breadcrumb.Item>{ getLocaleString('Sites') }</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{ getLocaleString('Areas') }{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ getLocaleString('Stations') }{this.state.areaName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add Station') }</Button>
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
                        <Form.Control type="text" placeholder={ getLocaleString('Search by Station Name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
              this.state.stations.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ getLocaleString('No station found.') }</p>
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
                                <td>{ getLocaleString('Description') }</td>
                                <td>{station.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, station.id, station.name)}>{ getLocaleString('Delete') }</Button>
                              <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/stations/${station.id}`)}>{ getLocaleString('Detail') }</Button>
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
                  <Form.Group controlId="stationName">
                    <Form.Label>{ getLocaleString('Station Name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the station name') }
                      defaultValue="" onChange={this.handleStationNameChange} className={ getInputFormValidationClassName(this.state.stationName, this.state.isStationNameValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="stationDescription">
                    <Form.Label>{ getLocaleString('Station Description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the station description') }
                      defaultValue="" onChange={this.handleStationDescriptionChange} className={ getInputFormValidationClassName(this.state.stationDescription, this.state.isStationDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addStation} disabled={this.state.isModalProcessing || !this.state.isStationNameValid || !this.state.isStationDescriptionValid}>{ getLocaleString('Register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this station') }: <strong>{this.state.stationName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  { getLocaleString('Every device belonged to the station will be deleted as well.') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteStation} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
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