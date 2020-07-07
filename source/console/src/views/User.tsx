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
import { Auth, PubSub } from 'aws-amplify';
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
import { LOGGING_LEVEL, FILE_SIZE_LIMIT, CustomError, sendMetrics, validateEmailAddress, sortByName, getLocaleString, getInputFormValidationClassName, makeVisibleBySearchKeyword } from '../util/CustomUtil';
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
      title: getLocaleString('Users'),
      users: [],
      csvUsers: [
        {
          username: getLocaleString('User E-Mail'),
          groups: getLocaleString('Enter a group name for each user. If a user belongs to more than one group, use a comma to separate each group name: AdminGroup, ManagerGroup, EngineerGroup, and AssociateGroup')
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
      csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
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
        user.groups = [ getLocaleString('Loading') ];
      }

      // Get user groups asynchronously for performance purpose
      this.getUserGroups(users);

      this.setState({
        users: sortByName(users, sort, 'username'),
        title: `${getLocaleString('Users')} (${users.length})`
      });
    } catch (error) {
      if (error instanceof CustomError) {
        this.setState({ error: error.message });
      } else {
        LOGGER.error('Error occurred while getting users.');
        LOGGER.debug(error);

        this.setState({ error: getLocaleString('Error occurred while getting users.') });
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
        title: `${getLocaleString('Users')} (${newUsers.length})`,
        email: '',
        groups: [],
        isModalProcessing: false,
        isEmailValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('User was added successfully.'), 'info', 5);
      await sendMetrics({ 'user': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while adding a user.');

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
          await PubSub.publish(`ava/groups/${userId}`, getLocaleString('User group has been changed. Please sign in again.'));
        } catch (error) {
          LOGGER.error('Error occurred to publish a message to group topic.');
        }
      }

      // When the user is not in the associate group anymore, delete the user's permission.
      if (user.groups.includes('AssociateGroup') && !editUser.groups.includes('AssociateGroup')) {
        await this.graphQlCommon.deletePermission(userId as string);
      }

      this.props.handleNotification(getLocaleString('User was edited successfully.'), 'info', 5);

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
      let message = getLocaleString('Error occurred while editing the user.');

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

      this.props.handleNotification(getLocaleString('User was deleted successfully.'), 'success', 5);
      this.setState({
        users: updatedUsers,
        title: `${getLocaleString('Users')} (${updatedUsers.length})`,
        email: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the user.');

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
        let lines = (file as string).replace(/"/g, '')
          .replace(/\r/g, '')
          .split('\n')
          .filter(line => line !== 'username,groups');

        // Do nothing if there's no data.
        if (lines.length === 0) {
          this.props.handleNotification(getLocaleString('There is no data in the CSV.'), 'error', 5);
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
                  result: getLocaleString('Success')
                });
              } catch (error) {
                uploadResult.push({
                  name: username,
                  result: getLocaleString('Failure')
                });
              }
            } else {
              uploadResult.push({
                name: username,
                result: getLocaleString('Username (E-Mail address) is not valid.')
              });
            }
          }

          this.setState({ uploadResult });
          this.getUsers();
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
   * @param {string | undefined} email - E-Mail address (username)
   * @param {string[] | undefined} groups - User groups
   */
  openModal(modalType: ModalType, user?: { email: string, groups?: string[], userId?: string }) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Add User');
    } else if (modalType === ModalType.Edit) {
      modalTitle = getLocaleString('Edit User');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete User');
    } else if (modalType === ModalType.Upload) {
      modalTitle = getLocaleString('Upload CSV');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
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
      csvFileName: getLocaleString('Select a CSV file with the downloaded format.'),
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
                <Breadcrumb.Item active>{ getLocaleString('Users') }</Breadcrumb.Item>
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
                        <Form.Control type="text" placeholder={ getLocaleString('Search by User Name (E-Mail)') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
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
                  <CSVLink data={this.state.csvUsers} filename={'user-upload-template.csv'} className="btn btn-primary btn-sm">{ getLocaleString('Download CSV Format') }</CSVLink>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Upload)}>{ getLocaleString('Upload CSV') }</Button>
                  <EmptyCol />
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add User') }</Button>
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
                <p>{ getLocaleString('No user found.') }</p>
              </Jumbotron>
            }
            {
              this.state.users.length > 0 && !this.state.isLoading &&
              <Card className="custom-card-big">
                <Card.Body>
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ getLocaleString('E-Mail') }</th>
                        <th>{ getLocaleString('Status') }</th>
                        <th>{ getLocaleString('Groups') }</th>
                        <th colSpan={2}>{ getLocaleString('Actions') }</th>
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
                                  onClick={() => this.openModal(ModalType.Edit, { email: user.username, groups: user.groups })}>{ getLocaleString('Edit') }</Button>
                              </td>
                              <td>
                                <Button variant="danger" size="sm" disabled={this.userId === user.username}
                                  onClick={() => this.openModal(ModalType.Delete, { email: user.username, userId: user.userId })}>{ getLocaleString('Delete') }</Button>
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
                  <Form.Group controlId="userName">
                    <Form.Label>{ getLocaleString('E-Mail') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the E-Mail address of user') }
                      defaultValue="" onChange={this.handleEmailChange} className={ getInputFormValidationClassName(this.state.email, this.state.isEmailValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must be a valid email address')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="userGroup">
                    <Form.Label>{ getLocaleString('Groups') }</Form.Label>
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
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addUser} disabled={this.state.isModalProcessing || !this.state.isEmailValid}>{ getLocaleString('Add') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Edit &&
            <div>
              <Modal.Body>
                <Form>
                  <Form.Group controlId="userName">
                    <Form.Label>{ getLocaleString('E-Mail') }</Form.Label>
                    <Form.Control type="text" defaultValue={this.state.email} disabled />
                  </Form.Group>
                  <Form.Group controlId="userGroup">
                    <Form.Label>{ getLocaleString('Groups') }</Form.Label>
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
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.editUser} disabled={this.state.isModalProcessing}>{ getLocaleString('Save') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this user') }: <strong>{this.state.email}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteUser} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
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
                        <th>{ getLocaleString('Username') }</th>
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

export default User;