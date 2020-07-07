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
import { CSVLink } from 'react-csv';
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
import { createRootCause } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, FILE_SIZE_LIMIT, sendMetrics, sortByName, getLocaleString, getInputFormValidationClassName, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IRootCause, IUploadResult } from '../components/Interfaces';
import { ModalType, SortBy } from '../components/Enums';
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
  title: string;
  rootCauses: IRootCause[];
  rootCause: string;
  id: string;
  csvRootCauses: { rootCause: string }[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isRootCauseValid: boolean;
  csvFile: File;
  csvFileName: string;
  isFileValid: boolean;
  uploadResult: IUploadResult[],
}

// Logging
const LOGGER = new Logger('RootCause', LOGGING_LEVEL);

/**
 * The root cause management page
 * @class RootCause
 */
class RootCause extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: getLocaleString('Root Causes'),
      rootCauses: [],
      rootCause: '',
      id: '',
      csvRootCauses: [{ rootCause: getLocaleString('Enter only one root cause in each row. Save the CSV file and upload to the web interface.') }],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isRootCauseValid: false,
      csvFile: new File([''], ''),
      csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
      isFileValid: false,
      uploadResult: []
    };

    this.graphQlCommon = new GraphQLCommon();

    this.getRootCauses = this.getRootCauses.bind(this);
    this.addRootCause = this.addRootCause.bind(this);
    this.deleteRootCause = this.deleteRootCause.bind(this);
    this.openModal = this.openModal.bind(this);
    this.uploadCsv = this.uploadCsv.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleRootCauseChange = this.handleRootCauseChange.bind(this);
    this.handleFileChange = this.handleFileChange.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    await this.getRootCauses();
  }

  /**
   * Get root causes.
   */
  async getRootCauses() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const rootCauses: IRootCause[] = await this.graphQlCommon.listRootCauses();
      const { searchKeyword, sort } = this.state;

      // Adds visible key/value for filter
      for (let rootCause of rootCauses) {
        rootCause.visible = searchKeyword === '' || rootCause.rootCause.includes(searchKeyword);
      }

      this.setState({
        rootCauses: sortByName(rootCauses, sort, 'rootCause'),
        title: `${getLocaleString('Root Causes')} (${rootCauses.length})`
      });
    } catch (error) {
      LOGGER.error('Error occurred while getting root causes.');
      this.setState({ error: getLocaleString('Error occurred while getting root causes.') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Add a root cause.
   */
  async addRootCause() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register root cause
      const { rootCauses, rootCause, searchKeyword, sort } = this.state;

      const response = await API.graphql(graphqlOperation(createRootCause, { rootCause }));
      const newRootCause: IRootCause = response.data.createRootCause;
      newRootCause.visible = searchKeyword === '' || newRootCause.rootCause.toLowerCase().includes(searchKeyword.toLowerCase());

      const newRootCauses = [...rootCauses, newRootCause];
      this.setState({
        rootCauses: sortByName(newRootCauses, sort, 'rootCause'),
        title: `${getLocaleString('Root Causes')} (${newRootCauses.length})`,
        rootCause: '',
        isModalProcessing: false,
        isRootCauseValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('Root cause was added successfully.'), 'info', 5);
      await sendMetrics({ 'rootCause': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while adding a root cause.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'DataDuplicatedError') {
          message = getLocaleString('Root cause already exists.');
        }
      }

      LOGGER.error('Error occurred while adding a root cause.', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Delete a root cause.
   */
  async deleteRootCause() {
    this.setState({ isModalProcessing: true });

    try {
      const { id } = this.state;
      await this.graphQlCommon.deleteRootCause(id);

      const updatedRootCauses = this.state.rootCauses.filter(rootCause => rootCause.id !== id);

      this.props.handleNotification(getLocaleString('Root cause was deleted successfully.'), 'success', 5);
      this.setState({
        rootCauses: updatedRootCauses,
        title: `${getLocaleString('Root Causes')} (${updatedRootCauses.length})`,
        rootCause: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the root cause.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'EventExistingError') {
          message = getLocaleString('You need to detach the root cause from all events.');
        }
      }

      LOGGER.error('Error while deleting root cause', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Upload CSV file.
   */
  async uploadCsv() {
    this.setState({ isModalProcessing: true });

    const { csvFile } = this.state;
    const reader = new FileReader();

    // Handle file error.
    reader.onerror = () => {
      this.setState({ isModalProcessing: false });
      reader.abort();
      this.props.handleNotification(getLocaleString('Error occurred while processing the CSV file.'), 'error', 5);
    }

    // Handle file load.
    reader.onload = async () => {
      try {
        /**
         * Read the CSV file, and remove the CSV header line.
         * The file supposed to contain quotation marks, so replace quotation marks to the blank.
         */
        const file = reader.result;
        const lines = (file as string).replace(/"/g, '')
          .replace(/\r/g, '')
          .split('\n')
          .filter(line => line !== 'rootCause');

        // Do nothing if there's no data.
        if (lines.length === 0) {
          this.props.handleNotification(getLocaleString('There is no data in the CSV.'), 'error', 5);
        } else {
          let uploadResult: IUploadResult[] = [];

          // Each line is expected to have valid root cause.
          for (let line of lines) {
            // Remove spaces
            const rootCause = line.trim().split(',')[0];

            // Validate root cause.
            if (/[a-zA-Z0-9- _/#()]$/.test(rootCause)) {
              try {
                await API.graphql(graphqlOperation(createRootCause, { rootCause }));

                uploadResult.push({
                  name: rootCause,
                  result: getLocaleString('Success')
                });
              } catch (error) {
                let message = getLocaleString('Failure');

                if (error.errors) {
                  const { errorType } = error.errors[0];

                  if (errorType === 'Unauthorized') {
                    message = getLocaleString('Not authorized, please contact your Admin.');
                  } else if (errorType === 'DataDuplicatedError') {
                    message = getLocaleString('Root cause already exists.');
                  }
                }

                uploadResult.push({
                  name: rootCause,
                  result: message
                });
              }
            } else {
              uploadResult.push({
                name: rootCause,
                result: getLocaleString('Root cause is not valid.')
              });
            }
          }

          this.setState({ uploadResult });
          this.getRootCauses();
        }
      } catch (error) {
        LOGGER.error(error);
        this.props.handleNotification(getLocaleString('An error occurred while processing CSV file.'), 'error', 5);
      } finally {
        this.setState({ isModalProcessing: false });
      }
    }

    reader.readAsText(csvFile);
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} id - Root cause ID
   */
  openModal(modalType: ModalType, id?: string, rootCause?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Add Root Cause');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete Root Cause');
    } else if (modalType === ModalType.Upload) {
      modalTitle = getLocaleString('Upload CSV');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      id: id ? id : '',
      rootCause: rootCause ? rootCause : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the root cause result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { rootCauses } = this.state;

    makeVisibleBySearchKeyword(rootCauses, 'rootCause', searchKeyword);
    this.setState({ rootCauses, searchKeyword });
  }

  /**
   * Handle sites sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const rootCauses = sortByName(this.state.rootCauses, sort, 'rootCause');

    this.setState({ rootCauses, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      id: '',
      rootCause: '',
      isRootCauseValid: false,
      csvFile: new File([''], ''),
      csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
      isFileValid: false,
      showModal: false,
      uploadResult: []
    });
  }

  /**
   * Handle the root cause change.
   * @param {any} event - Event from the root cause input
   */
  handleRootCauseChange(event: any) {
    const rootCause = event.target.value;
    const isRootCauseValid = /[a-zA-Z0-9- _/#()]$/.test(rootCause);

    this.setState({
      rootCause,
      isRootCauseValid
    });
  }

  /**
   * Handle the csv file input change.
   * @param {any} event - Event from the file input
   */
  handleFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      const { name, type, size } = file;
      const extension = name.split('.').pop();

      // Limit upload file size
      if (size > FILE_SIZE_LIMIT) {
        this.props.handleNotification(getLocaleString('CSV file size cannot be greater than 10KB.'), 'error', 5);
        this.setState({
          csvFile: new File([''], ''),
          csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
          isFileValid: false
        });
      } else if (type === 'text/csv' || extension === 'csv') {
        this.setState({
          csvFile: file,
          csvFileName: file.name,
          isFileValid: true
        });
      } else {
        this.props.handleNotification(getLocaleString('Choose CSV file with the downloaded format.'), 'error', 5);
        this.setState({
          csvFile: new File([''], ''),
          csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
          isFileValid: false
        });
      }
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
                <Breadcrumb.Item active>{ getLocaleString('Root Causes') }</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>{this.state.title}</Card.Title>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} md={4} controlId="searchKeyword">
                        <Form.Label>{ getLocaleString('Search Keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ getLocaleString('Search by Root Cause') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <CSVLink data={this.state.csvRootCauses} filename={'root-cause-upload-template.csv'} className="btn btn-primary btn-sm">{ getLocaleString('Download CSV Format') }</CSVLink>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Upload)}>{ getLocaleString('Upload CSV') }</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add Root Cause') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
            {
              this.state.rootCauses.length === 0 && !this.state.isLoading &&
              <Jumbotron>
                <p>{ getLocaleString('No root cause found.') }</p>
              </Jumbotron>
            }
            {
              this.state.rootCauses.length > 0 && !this.state.isLoading &&
              <Card className="custom-card-big">
                <Card.Body>
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ getLocaleString('Root Cause') }</th>
                        <th className="fixed-th-50">{ getLocaleString('Action') }</th>
                      </tr>
                    </thead>
                    <tbody>
                    {
                      this.state.rootCauses.filter((rootCause: IRootCause) => rootCause.visible)
                        .map((rootCause: IRootCause) => {
                          return (
                            <tr key={rootCause.id}>
                              <td>{rootCause.rootCause}</td>
                              <td>
                                <Button variant="danger" size="sm" onClick={() => this.openModal(ModalType.Delete, rootCause.id, rootCause.rootCause)}>{ getLocaleString('Delete') }</Button>
                              </td>
                            </tr>
                          );
                        })
                    }
                    </tbody>
                  </Table>
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
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{this.state.modalTitle}</Modal.Title>
          </Modal.Header>
          {
            this.state.modalType === ModalType.Add &&
            <div>
              <Modal.Body>
                <Form>
                  <Form.Group controlId="rootCause">
                    <Form.Label>{ getLocaleString('Root Cause') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the root cause') }
                      defaultValue="" onChange={this.handleRootCauseChange} className={ getInputFormValidationClassName(this.state.rootCause, this.state.isRootCauseValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/#()')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addRootCause} disabled={this.state.isModalProcessing || !this.state.isRootCauseValid}>{ getLocaleString('Add') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this root cause') }: <strong>{this.state.rootCause}</strong>?
                <EmptyRow />
                <Alert variant="warning">
                  { getLocaleString('This will not detach the root cause from any event it is currently linked to. You will need to do this manually from the Events page.') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteRootCause} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Upload &&
            <div>
              <Modal.Body>
                {
                  this.state.uploadResult.length === 0 &&
                  <Form.File>
                    <Form.File.Label>{ getLocaleString('Make sure you are using downloaded CSV format.') }</Form.File.Label>
                    <Form.File label={this.state.csvFileName} lang="en" accept=".csv" custom onChange={this.handleFileChange} disabled={this.state.isModalProcessing} />
                  </Form.File>
                }
                {
                  this.state.uploadResult.length > 0 && !this.state.isModalProcessing &&
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ getLocaleString('Root Cause') }</th>
                        <th>{ getLocaleString('Result') }</th>
                      </tr>
                    </thead>
                    <tbody>
                    {
                      this.state.uploadResult.map((result: IUploadResult) => {
                        let count = 0;
                        return (
                          <tr key={`${result.name}-${count++}`}>
                            <td>{result.name}</td>
                            <td>{result.result}</td>
                          </tr>
                        );
                      })
                    }
                    </tbody>
                  </Table>
                }
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                {
                  this.state.uploadResult.length === 0 &&
                  <Button variant="primary" onClick={this.uploadCsv} disabled={this.state.isModalProcessing || !this.state.isFileValid}>{ getLocaleString('Upload') }</Button>
                }
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

export default RootCause;