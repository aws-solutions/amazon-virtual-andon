// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { CSVLink } from 'react-csv';
import { Auth, PubSub, I18n } from 'aws-amplify';
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

// Import custom setting
import { LOGGING_LEVEL, FILE_SIZE_LIMIT, CustomError, sendMetrics, validateEmailAddress, sortByName, getInputFormValidationClassName, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import CognitoController from '../util/CognitoController';
import GraphQLCommon from '../util/GraphQLCommon';
import { IUser, ICSVUser, IUploadResult } from '../components/Interfaces';
import { ModalType, SortBy, UserGroups } from '../components/Enums';
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
  users: IUser[];
  csvUsers: ICSVUser[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  email: string;
  groups: string[];
  userId: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isEmailValid: boolean;
  csvFile: File;
  csvFileName: string;
  isFileValid: boolean;
  uploadResult: IUploadResult[],
}

// Logging
const LOGGER = new Logger('User', LOGGING_LEVEL);

/**
 * The user management page
 * @class User
 */
class User extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon = new GraphQLCommon();
  // User ID
  private userId: string = '';

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: I18n.get('text.users'),
      users: [],
      csvUsers: [
        {
          username: I18n.get('text.user.email'),
          groups: I18n.get('input.csv.groupname')
        }
      ],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      email: '',
      groups: [],
      userId: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isEmailValid: false,
      csvFile: new File([''], ''),
      csvFileName: I18n.get('text.select.csv.file'),
      isFileValid: false,
      uploadResult: []
    };

    this.getUsers = this.getUsers.bind(this);
    this.addUser = this.addUser.bind(this);
    this.editUser = this.editUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this.openModal = this.openModal.bind(this);
    this.uploadCsv = this.uploadCsv.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handleGroupChange = this.handleGroupChange.bind(this);
    this.handleFileChange = this.handleFileChange.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    const user = await Auth.currentAuthenticatedUser();
    this.userId = user.attributes.email;

    await this.getUsers();
  }

  /**
   * Get CognitoController.
   */
  async getCognitoController() {
    const credentials = await Auth.currentCredentials();
    return new CognitoController(credentials);
  }

  /**
   * Get users.
   */
  async getUsers() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const cognitoController = await this.getCognitoController();
      let users: IUser[] = await cognitoController.listUsers();

      const { searchKeyword, sort } = this.state;

      // Adds visible key/value for filter
      for (let user of users) {
        user.visible = searchKeyword === '' || user.username.includes(searchKeyword);
        user.groups = [ I18n.get('text.loading') ];
      }

      // Get user groups asynchronously for performance purpose
      this.getUserGroups(users);

      this.setState({
        users: sortByName(users, sort, 'username'),
        title: `${I18n.get('text.users')} (${users.length})`
      });
    } catch (error) {
      if (error instanceof CustomError) {
        this.setState({ error: error.message });
      } else {
        LOGGER.error('Error occurred while getting users.');
        LOGGER.debug(error);

        this.setState({ error: I18n.get('error.get.users') });
      }
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get users' groups.
   * @param {IUser[]} users - Users to get user groups
   */
  async getUserGroups(users: IUser[]) {
    const cognitoController = await this.getCognitoController();

    for (let user of users) {
      user.groups = await cognitoController.getUserGroups(user.username);

      // To prevent showing deleted users, remove users who do not exist.
      this.setState((prevState) => ({
        users: users.filter(tempUser =>
          prevState.users.map(prevUser => {
            return prevUser.userId;
          }).includes(tempUser.userId)
        )
      }));
    }
  }

  /**
   * Add a user.
   */
  async addUser() {
    this.setState({ isModalProcessing: true });

    try {
      const { users, email, groups, searchKeyword, sort } = this.state;
      const user: IUser = {
        username: email,
        groups: groups,
        status: ''
      };

      const cognitoController = await this.getCognitoController();
      const newUser = await cognitoController.addUser(user);
      newUser.visible = searchKeyword === '' || newUser.username.toLowerCase().includes(searchKeyword.toLowerCase());

      const newUsers = [...users, newUser];
      this.setState({
        users: sortByName(newUsers, sort, 'username'),
        title: `${I18n.get('text.users')} (${newUsers.length})`,
        email: '',
        groups: [],
        isModalProcessing: false,
        isEmailValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(I18n.get('info.add.user'), 'info', 5);
      await sendMetrics({ 'user': 1 });
    } catch (error) {
      let message = I18n.get('error.add.user');

      if (error instanceof CustomError) {
        message = error.message;
      } else {
        LOGGER.error('Error occurred while adding a user.');
        LOGGER.debug(error);
      }

      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Edit a user.
   */
  async editUser() {
    this.setState({ isModalProcessing: true });

    try {
      const { users, email, groups } = this.state;
      const editUser: IUser = {
        username: email,
        groups: groups,
        status: '',
      };

      const cognitoController = await this.getCognitoController();
      await cognitoController.editUser(editUser);

      const index = users.findIndex(indexUser => indexUser.username === editUser.username);
      const user = users[index];
      const { userId, visible, status } = user;
      editUser.visible = visible;
      editUser.status = status;
      editUser.userId = userId;

      // When edit happens and the highest group is different, publish a message to the topic.
      const currentHighestGroup = this.getHighestUserGroup(user);
      const newHighestGroup = this.getHighestUserGroup(editUser);

      if (currentHighestGroup !== newHighestGroup) {
        try {
          await PubSub.publish(`ava/groups/${userId}`, I18n.get('info.change.user.group'));
        } catch (error) {
          LOGGER.error('Error occurred to publish a message to group topic.');
        }
      }

      // When the user is not in the associate group anymore, delete the user's permission.
      if (user.groups.includes('AssociateGroup') && !editUser.groups.includes('AssociateGroup')) {
        await this.graphQlCommon.deletePermission(userId as string);
      }

      this.props.handleNotification(I18n.get('info.edit.user'), 'info', 5);

      this.setState({
        users: [
          ...users.slice(0, index),
          editUser,
          ...users.slice(index + 1)
        ],
        email: '',
        groups: [],
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.edit.user');

      if (error instanceof CustomError) {
        message = error.message;
      } else {
        LOGGER.error('Error occurred while editing the user.');
        LOGGER.debug(error);
      }

      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Get user's highest group.
   * @param {IUser} user - User to get the highest user group
   * @return {string} Highest user group
   */
  getHighestUserGroup(user: IUser): string {
    if (user.groups.includes('AdminGroup')) {
      return 'AdminGroup';
    } else if(user.groups.includes('ManagerGroup')) {
      return 'ManagerGroup';
    } else if(user.groups.includes('EngineerGroup')) {
      return 'EngineerGroup';
    } else if(user.groups.includes('AssociateGroup')) {
      return 'AssociateGroup';
    } else {
      return '';
    }
  }

  /**
   * Delete a user.
   */
  async deleteUser() {
    this.setState({ isModalProcessing: true });

    try {
      const { email, userId } = this.state;

      // Delete the user from Amazon Cognito user pool
      const cognitoController = await this.getCognitoController();
      await cognitoController.deleteUser(email);

      // Delete the user's permission if existing
      await this.graphQlCommon.deletePermission(userId);

      const updatedUsers = this.state.users.filter(user => user.userId !== userId);

      this.props.handleNotification(I18n.get('info.delete.user'), 'success', 5);
      this.setState({
        users: updatedUsers,
        title: `${I18n.get('text.users')} (${updatedUsers.length})`,
        email: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.user');

      if (error instanceof CustomError) {
        message = error.message;
      } else {
        LOGGER.error('Error occurred while deleting the user.');
        LOGGER.debug(error);
      }

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
        let lines = (file as string).replace(/"/g, '')
          .replace(/\r/g, '')
          .split('\n')
          .filter(line => line !== 'username,groups');

        // Do nothing if there's no data.
        if (lines.length === 0) {
          this.props.handleNotification(I18n.get('error.no.csv.data'), 'error', 5);
        } else {
          const cognitoController = await this.getCognitoController();
          let uploadResult: IUploadResult[] = [];

          // Each line is expected to have valid user E-Mail address and groups.
          for (let line of lines) {
            // Remove spaces
            const user = line.replace(/\s/g, '').split(',');
            const username = user[0];
            const groups = user.splice(1).filter(group => Object.values(UserGroups).toString().includes(group) && group !== '');

            // Validate username.
            if (validateEmailAddress(username)) {
              const newUser = {
                username,
                groups,
                status: ''
              };

              try {
                await cognitoController.addUser(newUser);

                uploadResult.push({
                  name: username,
                  result: I18n.get('text.success')
                });
              } catch (error) {
                uploadResult.push({
                  name: username,
                  result: I18n.get('text.failure')
                });
              }
            } else {
              uploadResult.push({
                name: username,
                result: I18n.get('Username (E-Mail address) is not valid.')
              });
            }
          }

          this.setState({ uploadResult });
          this.getUsers();
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
   * @param {string | undefined} email - E-Mail address (username)
   * @param {string[] | undefined} groups - User groups
   */
  openModal(modalType: ModalType, user?: { email: string, groups?: string[], userId?: string }) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = I18n.get('button.add.user');
    } else if (modalType === ModalType.Edit) {
      modalTitle = I18n.get('text.edit.user');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.user');
    } else if (modalType === ModalType.Upload) {
      modalTitle = I18n.get('text.upload.csv');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
      return;
    }

    if (!user) {
      user = {
        email: '',
        groups: [],
        userId: ''
      };
    }

    this.setState({
      modalType,
      modalTitle,
      email: user.email,
      groups: user.groups ? user.groups : [],
      userId: user.userId ? user.userId : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the user result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { users } = this.state;

    makeVisibleBySearchKeyword(users, 'username', searchKeyword);
    this.setState({ users, searchKeyword });
  }

  /**
   * Handle sites sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const users = sortByName(this.state.users, sort, 'username');

    this.setState({ users, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      email: '',
      groups: [],
      isEmailValid: false,
      csvFile: new File([''], ''),
      csvFileName: I18n.get('text.select.csv.file'),
      isFileValid: false,
      showModal: false,
      uploadResult: []
    });
  }

  /**
   * Handle the E-Mail change.
   * @param {any} event - Event from the E-Mail input
   */
  handleEmailChange(event: any) {
    const email = event.target.value;
    const isEmailValid = validateEmailAddress(email);

    this.setState({
      email,
      isEmailValid
    });
  }

  /**
   * Handle the user group change.
   * @param {any} event - Event from the group checkbox
   */
  handleGroupChange(event: any) {
    const { id, checked } = event.target;
    let groups = this.state.groups;

    if (checked) {
      groups = [
        ...groups,
        id
      ];
    } else {
      groups = groups.filter(group => group !== id);
    }

    this.setState({ groups });
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
                <Breadcrumb.Item active>{ I18n.get('text.users') }</Breadcrumb.Item>
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
                        <Form.Control type="text" placeholder={ I18n.get('text.search.user.name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
                  <CSVLink data={this.state.csvUsers} filename={'user-upload-template.csv'} className="btn btn-primary btn-sm">{ I18n.get('button.download.csv.format') }</CSVLink>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Upload)}>{ I18n.get('button.upload.csv') }</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ I18n.get('button.add.user') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
            {
              this.state.users.length === 0 && !this.state.isLoading &&
              <Jumbotron>
                <p>{ I18n.get('text.no.user') }</p>
              </Jumbotron>
            }
            {
              this.state.users.length > 0 && !this.state.isLoading &&
              <Card className="custom-card-big">
                <Card.Body>
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ I18n.get('text.email') }</th>
                        <th>{ I18n.get('text.status') }</th>
                        <th>{ I18n.get('text.groups') }</th>
                        <th colSpan={2}>{ I18n.get('text.actions') }</th>
                      </tr>
                    </thead>
                    <tbody>
                    {
                      this.state.users.filter((user: IUser) => user.visible)
                        .map((user: IUser) => {
                          return (
                            <tr key={user.username}>
                              <td>{user.username}</td>
                              <td>{user.status}</td>
                              <td>{user.groups.join(', ')}</td>
                              <td>
                                <Button variant="primary" size="sm" disabled={this.userId === user.username}
                                  onClick={() => this.openModal(ModalType.Edit, { email: user.username, groups: user.groups })}>{ I18n.get('button.edit') }</Button>
                              </td>
                              <td>
                                <Button variant="danger" size="sm" disabled={this.userId === user.username}
                                  onClick={() => this.openModal(ModalType.Delete, { email: user.username, userId: user.userId })}>{ I18n.get('button.delete') }</Button>
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
                  <Form.Group controlId="userName">
                    <Form.Label>{ I18n.get('text.email') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ I18n.get('input.user.email') }
                      defaultValue="" onChange={this.handleEmailChange} className={ getInputFormValidationClassName(this.state.email, this.state.isEmailValid) } />
                    <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.email')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="userGroup">
                    <Form.Label>{ I18n.get('text.groups') }</Form.Label>
                    <div>
                      <Form.Check inline id="AdminGroup" type="checkbox" label="Admin Group" onChange={this.handleGroupChange} />
                      <Form.Check inline id="ManagerGroup" type="checkbox" label="Manager Group" onChange={this.handleGroupChange} />
                      <Form.Check inline id="EngineerGroup" type="checkbox" label="Engineer Group" onChange={this.handleGroupChange} />
                      <Form.Check inline id="AssociateGroup" type="checkbox" label="Associate Group" onChange={this.handleGroupChange} />
                    </div>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="primary" onClick={this.addUser} disabled={this.state.isModalProcessing || !this.state.isEmailValid}>{ I18n.get('button.add') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Edit &&
            <div>
              <Modal.Body>
                <Form>
                  <Form.Group controlId="userName">
                    <Form.Label>{ I18n.get('text.email') }</Form.Label>
                    <Form.Control type="text" defaultValue={this.state.email} disabled />
                  </Form.Group>
                  <Form.Group controlId="userGroup">
                    <Form.Label>{ I18n.get('text.groups') }</Form.Label>
                    <div>
                      <Form.Check inline id="AdminGroup" type="checkbox" label="Admin Group" onChange={this.handleGroupChange} checked={this.state.groups.includes('AdminGroup')} />
                      <Form.Check inline id="ManagerGroup" type="checkbox" label="Manager Group" onChange={this.handleGroupChange} checked={this.state.groups.includes('ManagerGroup')} />
                      <Form.Check inline id="EngineerGroup" type="checkbox" label="Engineer Group" onChange={this.handleGroupChange} checked={this.state.groups.includes('EngineerGroup')} />
                      <Form.Check inline id="AssociateGroup" type="checkbox" label="Associate Group" onChange={this.handleGroupChange} checked={this.state.groups.includes('AssociateGroup')} />
                    </div>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="primary" onClick={this.editUser} disabled={this.state.isModalProcessing}>{ I18n.get('button.save') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { I18n.get('text.confirm.delete.user') }: <strong>{this.state.email}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="danger" onClick={this.deleteUser} disabled={this.state.isModalProcessing}>{ I18n.get('button.delete') }</Button>
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
                        <th>{ I18n.get('text.username') }</th>
                        <th>{ I18n.get('text.result') }</th>
                      </tr>
                    </thead>
                    <tbody>
                    {
                      this.state.uploadResult.map((result: IUploadResult) => {
                        return (
                          <tr key={result.name}>
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

export default User;