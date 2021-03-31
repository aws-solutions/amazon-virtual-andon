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
import { getSite } from '../graphql/queries';
import { createArea } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, sortByName, getInputFormValidationClassName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData } from '../components/Interfaces';
import { ModalType, SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';
import EmptyCol from '../components/EmptyCol';

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
  areas: IGeneralQueryData[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  areaDescription: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isAreaNameValid: boolean;
  isAreaDescriptionValid: boolean;
}

// Logging
const LOGGER = new Logger('Area', LOGGING_LEVEL);

/**
 * The area page
 * @class Area
 */
class Area extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: I18n.get('text.areas'),
      areas: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      areaDescription: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isAreaNameValid: false,
      isAreaDescriptionValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteArea = this.deleteArea.bind(this);
    this.addArea = this.addArea.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleAreaNameChange = this.handleAreaNameChange.bind(this);
    this.handleAreaDescriptionChange = this.handleAreaDescriptionChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    await this.getSite();
  }

  /**
   * Get the site detail.
   */
  async getSite() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Graphql operation to get a site
      const { siteId } = this.props.match.params;
      const response = await API.graphql(graphqlOperation(getSite, { id: siteId })) as GraphQLResult;
      const data: any = response.data;
      const siteName = `: ${data.getSite.name}`;
      let areas: IGeneralQueryData[] = data.getSite.area.items;

      // Make all areas visible.
      makeAllVisible(areas);

      // Sorts initially
      areas.sort((a, b) => a.name.localeCompare(b.name));

      this.setState({
        siteId,
        siteName,
        areas,
        title: `${I18n.get('text.areas')} (${areas.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting site', error);
      this.setState({ error: I18n.get('error.get.site') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete an area.
   */
  async deleteArea() {
    this.setState({ isModalProcessing: true });

    try {
      // This will delete every process, station, event, and device belonged to the area as well.
      const { areaId } = this.state;
      await this.graphQlCommon.deleteArea(areaId);

      const updatedAreas = this.state.areas.filter(area => area.id !== areaId);

      this.props.handleNotification(I18n.get('info.delete.area'), 'success', 5);
      this.setState({
        areas: updatedAreas,
        title: `${I18n.get('text.areas')} (${updatedAreas.length})`,
        areaId: '',
        areaName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.area');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while deleting area', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register an area.
   */
  async addArea() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register an area
      const { areas, siteId, areaName, areaDescription, searchKeyword, sort } = this.state;
      const input = {
        areaSiteId: siteId,
        name: areaName,
        description: areaDescription,
        __typename: 'Area'
      };

      const response = await API.graphql(graphqlOperation(createArea, input)) as GraphQLResult;
      const data: any = response.data;
      let newArea: IGeneralQueryData = data.createArea;
      newArea.visible = searchKeyword === '' || newArea.name.toLowerCase().includes(searchKeyword.toLowerCase());

      const newAreas = [...areas, newArea];
      this.setState({
        areas: sortByName(newAreas, sort, 'name'),
        title: `${I18n.get('text.areas')} (${newAreas.length})`,
        areaName: '',
        areaDescription: '',
        isModalProcessing: false,
        isAreaNameValid: false,
        isAreaDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(I18n.get('info.add.area'), 'info', 5);
      await sendMetrics({ 'area': 1 });
    } catch (error) {
      let message = I18n.get('error.create.area');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.area.name');
        }
      }

      LOGGER.error('Error while adding area', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} areaId - Area ID
   * @param {string | undefined} areaName - Area Name
   */
  openModal(modalType: ModalType, areaId?: string, areaName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = I18n.get('text.area.registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.area');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      areaId: areaId ? areaId : '',
      areaName: areaName ? areaName : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the area result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { areas } = this.state;

    makeVisibleBySearchKeyword(areas, 'name', searchKeyword);
    this.setState({ areas, searchKeyword });
  }

  /**
   * Handle areas sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const areas = sortByName(this.state.areas, sort, 'name');

    this.setState({ areas });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      areaId: '',
      areaName: '',
      areaDescription: '',
      isAreaNameValid: false,
      isAreaDescriptionValid: false,
      showModal: false
    });
  }

  /**
   * Handle the area name change.
   * @param {any} event - Event from the area name input
   */
  handleAreaNameChange(event: any) {
    const areaName = event.target.value;
    const isAreaNameValid = validateGeneralInput(areaName, 1, 40, '- _/#');

    this.setState({
      areaName,
      isAreaNameValid
    });
  }

  /**
   * Handle the area description change.
   * @param {any} event - Event from the area description input
   */
  handleAreaDescriptionChange(event: any) {
    const areaDescription = event.target.value;
    const isAreaDescriptionValid = validateGeneralInput(areaDescription, 1, 40, '- _/#');

    this.setState({
      areaDescription,
      isAreaDescriptionValid
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
                  <Breadcrumb.Item>{ I18n.get('text.sites') }</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ I18n.get('text.areas') }{this.state.siteName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ I18n.get('button.add.area') }</Button>
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
                        <Form.Label>{ I18n.get('text.search.keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ I18n.get('text.search.area.name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{ I18n.get('text.sort.by') }</Form.Label>
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
              this.state.areas.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ I18n.get('text.no.area') }</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.areas.filter((area: IGeneralQueryData) => area.visible)
                .map((area: IGeneralQueryData) => {
                  return (
                    <Col md={4} key={area.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{area.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{ I18n.get('text.description') }</td>
                                <td>{area.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, area.id, area.name)}>{ I18n.get('button.delete') }</Button>
                              <Form.Row>
                                <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/areas/${area.id}/stations`)}>{ I18n.get('text.stations') }</Button>
                                <EmptyCol />
                                <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/areas/${area.id}/processes`)}>{ I18n.get('info.processes') }</Button>
                              </Form.Row>
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
                  <strong>{ I18n.get('error') }:</strong><br />
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
                  <Form.Group controlId="areaName">
                    <Form.Label>{ I18n.get('text.area.name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.area.name') }
                      defaultValue="" onChange={this.handleAreaNameChange} className={ getInputFormValidationClassName(this.state.areaName, this.state.isAreaNameValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="areaDescription">
                    <Form.Label>{ I18n.get('text.area.description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.area.description') }
                      defaultValue="" onChange={this.handleAreaDescriptionChange} className={ getInputFormValidationClassName(this.state.areaDescription, this.state.isAreaDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="primary" onClick={this.addArea} disabled={this.state.isModalProcessing || !this.state.isAreaNameValid || !this.state.isAreaDescriptionValid}>{ I18n.get('button.register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { I18n.get('text.confirm.delete.area') }: <strong>{this.state.areaName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  { I18n.get('warning.delete.area') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="danger" onClick={this.deleteArea} disabled={this.state.isModalProcessing}>{ I18n.get('button.delete') }</Button>
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

export default Area;