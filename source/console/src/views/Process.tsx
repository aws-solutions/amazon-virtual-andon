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
import { createProcess } from '../graphql/mutations';

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
  processes: IGeneralQueryData[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  processId: string;
  processName: string;
  processDescription: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isProcessNameValid: boolean;
  isProcessDescriptionValid: boolean;
}

// Logging
const LOGGER = new Logger('Station', LOGGING_LEVEL);

/**
 * The process page
 * @class Process
 */
class Process extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: getLocaleString('Processes'),
      processes: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      processId: '',
      processName: '',
      processDescription: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isProcessNameValid: false,
      isProcessDescriptionValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteProcess = this.deleteProcess.bind(this);
    this.addProcess = this.addProcess.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleProcessNameChange = this.handleProcessNameChange.bind(this);
    this.handleProcessDescriptionChange = this.handleProcessDescriptionChange.bind(this);
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
      let processes: IGeneralQueryData[] = response.data.getArea.process.items;

      // Make all processes visible.
      makeAllVisible(processes);

      // Sorts initially
      processes.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        processes,
        title: `${getLocaleString('Processes')} (${processes.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting area', error);
      this.setState({ error: getLocaleString('Error occurred while getting an area.') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete a process.
   */
  async deleteProcess() {
    this.setState({ isModalProcessing: true });

    try {
      // This will delete every event belonged to the process as well.
      const { processId } = this.state;
      await this.graphQlCommon.deleteProcess(processId);

      const updatedProcesses = this.state.processes.filter(process => process.id !== processId);

      this.props.handleNotification(getLocaleString('Process was deleted successfully.'), 'success', 5);
      this.setState({
        processes: updatedProcesses,
        title: `${getLocaleString('Processes')} (${updatedProcesses.length})`,
        processId: '',
        processName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the process.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error while deleting proces', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register a process.
   */
  async addProcess() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register a process
      const { processes, areaId, processName, processDescription, searchKeyword, sort } = this.state;
      const input = {
        processAreaId: areaId,
        name: processName,
        description: processDescription,
        __typename: 'Process'
      };

      const response = await API.graphql(graphqlOperation(createProcess, input));
      let newProcess: IGeneralQueryData = response.data.createProcess;
      newProcess.visible = searchKeyword === '' || newProcess.name.toLowerCase().includes(searchKeyword.toLowerCase());

      this.setState({
        processes: sortByName([...processes, newProcess], sort, 'name'),
        processName: '',
        processDescription: '',
        isModalProcessing: false,
        isProcessNameValid: false,
        isProcessDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('Process was added successfully.'), 'info', 5);
      await sendMetrics({ 'process': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while creating a process.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'DataDuplicatedError') {
          message = getLocaleString('Process name already exists.');
        }
      }

      LOGGER.error('Error while creating process', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} processId - Process ID
   * @param {string | undefined} processName  - Process Name
   */
  openModal(modalType: ModalType, processId?: string, processName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Process Registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete Process');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      processId: processId ? processId : '',
      processName: processName ? processName : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the processes result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { processes } = this.state;

    makeVisibleBySearchKeyword(processes, 'name', searchKeyword);
    this.setState({ processes, searchKeyword });
  }

  /**
   * Handle processes sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const processes = sortByName(this.state.processes, sort, 'name');

    this.setState({ processes, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      processId: '',
      processName: '',
      processDescription: '',
      isProcessNameValid: false,
      isProcessDescriptionValid: false,
      showModal: false
    });
  }

  /**
   * Handle the process name change.
   * @param {any} event - Event from the process name input
   */
  handleProcessNameChange(event: any) {
    const processName = event.target.value;
    const isProcessNameValid = validateGeneralInput(processName);

    this.setState({
      processName,
      isProcessNameValid
    });
  }

  /**
   * Handle the process description change.
   * @param {any} event - Event from the process description input
   */
  handleProcessDescriptionChange(event: any) {
    const processDescription = event.target.value;
    const isProcessDescriptionValid = validateGeneralInput(processDescription);

    this.setState({
      processDescription,
      isProcessDescriptionValid
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
                <Breadcrumb.Item active>{ getLocaleString('Processes') }{this.state.areaName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add Process') }</Button>
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
                        <Form.Control type="text" placeholder={ getLocaleString('Search by Process Name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
              this.state.processes.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ getLocaleString('No process found.') }</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.processes.filter((process: IGeneralQueryData) => process.visible)
                .map((process: IGeneralQueryData) => {
                  return (
                    <Col md={4} key={process.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{process.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{ getLocaleString('Description') }</td>
                                <td>{process.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, process.id, process.name)}>{ getLocaleString('Delete') }</Button>
                              <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/processes/${process.id}`)}>{ getLocaleString('Detail') }</Button>
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
                  <Form.Group controlId="processName">
                    <Form.Label>{ getLocaleString('Process Name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the process name') }
                      defaultValue="" onChange={this.handleProcessNameChange} className={ getInputFormValidationClassName(this.state.processName, this.state.isProcessNameValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="processDescription">
                    <Form.Label>{ getLocaleString('Process Description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the process description') }
                      defaultValue="" onChange={this.handleProcessDescriptionChange} className={ getInputFormValidationClassName(this.state.processDescription, this.state.isProcessDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addProcess} disabled={this.state.isModalProcessing || !this.state.isProcessNameValid || !this.state.isProcessDescriptionValid}>{ getLocaleString('Register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this process') }: <strong>{this.state.processName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  { getLocaleString('Every event belonged to the proces will be deleted as well.') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteProcess} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
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

export default Process;