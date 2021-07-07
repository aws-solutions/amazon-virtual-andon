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
import { createProcess } from '../graphql/mutations';

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
      title: I18n.get('info.processes'),
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
      const response = await API.graphql(graphqlOperation(getArea, { id: areaId })) as GraphQLResult;
      const data: any = response.data;
      const siteId = data.getArea.site.id;
      const siteName = `: ${data.getArea.site.name}`;
      const areaName = `: ${data.getArea.name}`;
      let processes: IGeneralQueryData[] = data.getArea.process.items;

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
        title: `${I18n.get('info.processes')} (${processes.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting area', error);
      this.setState({ error: I18n.get('error.get.area') });
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

      this.props.handleNotification(I18n.get('info.delete.process'), 'success', 5);
      this.setState({
        processes: updatedProcesses,
        title: `${I18n.get('info.processes')} (${updatedProcesses.length})`,
        processId: '',
        processName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.process');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
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

      const response = await API.graphql(graphqlOperation(createProcess, input)) as GraphQLResult;
      const data: any = response.data;
      let newProcess: IGeneralQueryData = data.createProcess;
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

      this.props.handleNotification(I18n.get('info.add.process'), 'info', 5);
      await sendMetrics({ 'process': 1 });
    } catch (error) {
      let message = I18n.get('error.create.process');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.process.name');
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
      modalTitle = I18n.get('text.process.registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.process');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
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
    const isProcessNameValid = validateGeneralInput(processName, 1, 40, '- _/#');

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
    const isProcessDescriptionValid = validateGeneralInput(processDescription, 1, 40, '- _/#');

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
                  <Breadcrumb.Item>{ I18n.get('text.sites') }</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{ I18n.get('text.areas') }{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ I18n.get('info.processes') }{this.state.areaName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ I18n.get('button.add.process') }</Button>
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
                        <Form.Control type="text" placeholder={ I18n.get('text.search.process.name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
              this.state.processes.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ I18n.get('text.no.process') }</p>
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
                                <td>{ I18n.get('text.description') }</td>
                                <td>{process.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, process.id, process.name)}>{ I18n.get('button.delete') }</Button>
                              <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/processes/${process.id}`)}>{ I18n.get('button.detail') }</Button>
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
                  <Form.Group controlId="processName">
                    <Form.Label>{ I18n.get('text.process.name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.process.name') }
                      defaultValue="" onChange={this.handleProcessNameChange} className={ getInputFormValidationClassName(this.state.processName, this.state.isProcessNameValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="processDescription">
                    <Form.Label>{ I18n.get('text.process.description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.process.description') }
                      defaultValue="" onChange={this.handleProcessDescriptionChange} className={ getInputFormValidationClassName(this.state.processDescription, this.state.isProcessDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="primary" onClick={this.addProcess} disabled={this.state.isModalProcessing || !this.state.isProcessNameValid || !this.state.isProcessDescriptionValid}>{ I18n.get('button.register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { I18n.get('text.confirm.delete.process') }: <strong>{this.state.processName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  { I18n.get('warning.delete.process') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="danger" onClick={this.deleteProcess} disabled={this.state.isModalProcessing}>{ I18n.get('button.delete') }</Button>
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