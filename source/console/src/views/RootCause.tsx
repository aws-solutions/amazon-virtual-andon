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
import Modal from 'react-bootstrap/Modal';

// Import graphql
import { createRootCause } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, FILE_SIZE_LIMIT, sendMetrics, sortByName, getInputFormValidationClassName, makeVisibleBySearchKeyword, validateGeneralInput } from '../util/CustomUtil';
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
      title: I18n.get('text.rootcauses'),
      rootCauses: [],
      rootCause: '',
      id: '',
      csvRootCauses: [{ rootCause: I18n.get('input.csv.rootcause') }],
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
      csvFileName: I18n.get('text.select.csv.file'),
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
        title: `${I18n.get('text.rootcauses')} (${rootCauses.length})`
      });
    } catch (error) {
      LOGGER.error('Error occurred while getting root causes.');
      this.setState({ error: I18n.get('error.get.rootcauses') });
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
        title: `${I18n.get('text.rootcauses')} (${newRootCauses.length})`,
        rootCause: '',
        isModalProcessing: false,
        isRootCauseValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(I18n.get('info.add.rootcause'), 'info', 5);
      await sendMetrics({ 'rootCause': 1 });
    } catch (error) {
      let message = I18n.get('error.add.rootcause');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.rootcause');
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

      this.props.handleNotification(I18n.get('info.delete.rootcause'), 'success', 5);
      this.setState({
        rootCauses: updatedRootCauses,
        title: `${I18n.get('text.rootcauses')} (${updatedRootCauses.length})`,
        rootCause: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.rootcause');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'EventExistingError') {
          message = I18n.get('error.detach.rootcause.from.events');
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
      this.props.handleNotification(I18n.get('error.process.csv'), 'error', 5);
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
          this.props.handleNotification(I18n.get('error.no.csv.data'), 'error', 5);
        } else {
          let uploadResult: IUploadResult[] = [];

          // Each line is expected to have valid root cause.
          for (let line of lines) {
            // Remove spaces
            const rootCause = line.trim().split(',')[0];

            // Validate root cause.
            // if (/[a-zA-Z0-9- _/#()]$/.test(rootCause)) {
            if (validateGeneralInput(rootCause, 1, 100, '- _/#()')) {
              try {
                await API.graphql(graphqlOperation(createRootCause, { rootCause }));

                uploadResult.push({
                  name: rootCause,
                  result: I18n.get('text.success')
                });
              } catch (error) {
                let message = I18n.get('text.failure');

                if (error.errors) {
                  const { errorType } = error.errors[0];

                  if (errorType === 'Unauthorized') {
                    message = I18n.get('error.not.authorized');
                  } else if (errorType === 'DataDuplicatedError') {
                    message = I18n.get('error.duplicate.rootcause');
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
                result: I18n.get('error.invalid.rootcause')
              });
            }
          }

          this.setState({ uploadResult });
          this.getRootCauses();
        }
      } catch (error) {
        LOGGER.error(error);
        this.props.handleNotification(I18n.get('An error occurred while processing CSV file.'), 'error', 5);
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
      modalTitle = I18n.get('button.add.rootcause');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.rootcause');
    } else if (modalType === ModalType.Upload) {
      modalTitle = I18n.get('text.upload.csv');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
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
      csvFileName: I18n.get('text.select.csv.file'),
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
    const isRootCauseValid = validateGeneralInput(rootCause, 1, 100, '- _/#()');

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
        this.props.handleNotification(I18n.get('error.limit.csv.size'), 'error', 5);
        this.setState({
          csvFile: new File([''], ''),
          csvFileName: I18n.get('text.select.csv.file'),
          isFileValid: false
        });
      } else if (type === 'text/csv' || extension === 'csv') {
        this.setState({
          csvFile: file,
          csvFileName: file.name,
          isFileValid: true
        });
      } else {
        this.props.handleNotification(I18n.get('error.choose.csv'), 'error', 5);
        this.setState({
          csvFile: new File([''], ''),
          csvFileName: I18n.get('text.select.csv.file'),
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
                <Breadcrumb.Item active>{ I18n.get('text.rootcauses') }</Breadcrumb.Item>
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
                        <Form.Label>{ I18n.get('text.search.keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ I18n.get('text.search.rootcause') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <CSVLink data={this.state.csvRootCauses} filename={'root-cause-upload-template.csv'} className="btn btn-primary btn-sm">{ I18n.get('button.download.csv.format') }</CSVLink>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Upload)}>{ I18n.get('button.upload.csv') }</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ I18n.get('button.add.rootcause') }</Button>
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
                <p>{ I18n.get('text.no.rootcause') }</p>
              </Jumbotron>
            }
            {
              this.state.rootCauses.length > 0 && !this.state.isLoading &&
              <Card className="custom-card-big">
                <Card.Body>
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ I18n.get('text.rootcause') }</th>
                        <th className="fixed-th-150">{ I18n.get('text.action') }</th>
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
                                <Button variant="danger" size="sm" onClick={() => this.openModal(ModalType.Delete, rootCause.id, rootCause.rootCause)}>{ I18n.get('button.delete') }</Button>
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
                  <Form.Group controlId="rootCause">
                    <Form.Label>{ I18n.get('text.rootcause') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.rootcause') }
                      defaultValue="" onChange={this.handleRootCauseChange} className={ getInputFormValidationClassName(this.state.rootCause, this.state.isRootCauseValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.rootcause')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="primary" onClick={this.addRootCause} disabled={this.state.isModalProcessing || !this.state.isRootCauseValid}>{ I18n.get('button.add') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { I18n.get('text.confirm.delete.rootcause') }: <strong>{this.state.rootCause}</strong>?
                <EmptyRow />
                <Alert variant="warning">
                  { I18n.get('warning.delete.rootcause') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="danger" onClick={this.deleteRootCause} disabled={this.state.isModalProcessing}>{ I18n.get('button.delete') }</Button>
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
                    <Form.File.Label>{ I18n.get('info.upload.csv') }</Form.File.Label>
                    <Form.File label={this.state.csvFileName} data-browse={I18n.get('button.browse')} accept=".csv" custom onChange={this.handleFileChange} disabled={this.state.isModalProcessing} />
                  </Form.File>
                }
                {
                  this.state.uploadResult.length > 0 && !this.state.isModalProcessing &&
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ I18n.get('text.rootcause') }</th>
                        <th>{ I18n.get('text.result') }</th>
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
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                {
                  this.state.uploadResult.length === 0 &&
                  <Button variant="primary" onClick={this.uploadCsv} disabled={this.state.isModalProcessing || !this.state.isFileValid}>{ I18n.get('button.upload') }</Button>
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