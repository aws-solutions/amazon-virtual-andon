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
import { Auth } from 'aws-amplify';
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
import { LOGGING_LEVEL, CustomError, sortByName, getLocaleString, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import CognitoController from '../util/CognitoController';
import GraphQLCommon from '../util/GraphQLCommon';
import { IPermission, IUser } from '../components/Interfaces';
import { SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';

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
  permissions: IPermission[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  user: { userId: string, username: string, version: number };
  showModal: boolean;
  isModalProcessing: boolean;
  isEmailValid: boolean;
}

// Logging
const LOGGER = new Logger('Permission', LOGGING_LEVEL);

// Init user
const INIT_USER = { userId: '', username: '', version: 0 };

/**
 * The permission page
 * @class Permission
 */
class Permission extends React.Component<IProps, IState> {
  // Users
  private users: IUser[];
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: getLocaleString('Permissions'),
      permissions: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      user: INIT_USER,
      showModal: false,
      isModalProcessing: false,
      isEmailValid: false
    };

    this.users = [];
    this.graphQlCommon = new GraphQLCommon();

    this.getPermissions = this.getPermissions.bind(this);
    this.getUsers = this.getUsers.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.addPermission = this.addPermission.bind(this);
    this.editPermission = this.editPermission.bind(this);
    this.deletePermission = this.deletePermission.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    localStorage.removeItem('ava_permission_mode');
    localStorage.removeItem('ava_permission');
    localStorage.removeItem('ava_users');

    await this.getPermissions();
  }

  /**
   * Get CognitoController.
   */
  async getCognitoController() {
    const credentials = await Auth.currentCredentials();
    return new CognitoController(credentials);
  }

  /**
   * Get permissions.
   */
  async getPermissions() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Get users
      await this.getUsers();

      // Get permissions
      const permissions: IPermission[] = await this.graphQlCommon.listPermissions();

      // Add visible key/value for filter
      for (let permission of permissions) {
        permission.visible = true;
        permission.username = this.getUsername(permission.userId);
      }

      // Change visible for exsiting users
      for (let user of this.users) {
        const filteredPermissions = permissions.filter(permission => permission.userId === user.userId);
        user.visible = filteredPermissions.length === 0;
      }

      const { sort } = this.state;
      this.setState({
        permissions: sortByName(permissions, sort, 'username'),
        title: `${getLocaleString('Permissions')} (${permissions.length})`
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while getting permissions.');

      if (error instanceof CustomError) {
        message = error.message;
      } else if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error occurred while getting permissions.', error);
      this.setState({ error: message });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get users.
   */
  async getUsers() {
    try {
      const cognitoController = await this.getCognitoController();
      const users = await cognitoController.listAssociateGroupUsers();
      this.users = sortByName(users, SortBy.Asc, 'username');
    } catch (error) {
      LOGGER.error('Error occurred while getting users.');

      throw error;
    }
  }

  /**
   * Get user name with user ID
   * @param {string} userId - The user ID to get user name
   * @return {string} User name
   */
  getUsername(userId: string): string {
    const users = this.users.filter(user => user.userId === userId);

    if (users.length > 0) {
      return users[0].username
    } else {
      return 'N/A';
    }
  }

  /**
   * Add a permission.
   */
  addPermission() {
    localStorage.setItem('ava_permission_mode', 'add');
    localStorage.setItem('ava_users', Buffer.from(JSON.stringify(this.users)).toString('base64'));
    this.props.history.push('/permissions/setting');
  }

  /**
   * Edit a permission.
   * @param {IPermission} permission - Permission to edit
   */
  editPermission(permission: IPermission) {
    localStorage.setItem('ava_permission_mode', 'edit');
    localStorage.setItem('ava_permission', JSON.stringify(permission));
    this.props.history.push('/permissions/setting');
  }

  /**
   * Delete a permission.
   */
  async deletePermission() {
    this.setState({ isModalProcessing: true });

    try {
      const { user, permissions } = this.state;
      const { userId } = user;

      // Graphql operation to get permissions
      await this.graphQlCommon.deletePermission(userId);
      const updatedPermissions = permissions.filter(permission => permission.userId !== userId);

      // Set user visilibity
      for (let currentUser of this.users) {
        if (currentUser.userId === userId) {
          currentUser.visible = true;
          break;
        }
      }

      this.props.handleNotification(getLocaleString('Permission was deleted successfully.'), 'success', 5);
      this.setState({
        permissions: updatedPermissions,
        title: `${getLocaleString('Permissions')} (${updatedPermissions.length})`,
        user: INIT_USER,
        isModalProcessing: false,
        showModal: false
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the permission.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error while deleting permission', error);
      this.props.handleNotification(getLocaleString(message), 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal.
   * @param {{ userId: string, username: string, version: number }} user - User
   */
  openModal(user: { userId: string, username: string, version: number }) {
    this.setState({
      user,
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the permission result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { permissions } = this.state;

    makeVisibleBySearchKeyword(permissions, 'username', searchKeyword);
    this.setState({ permissions, searchKeyword });
  }

  /**
   * Handle permissions sort by user E-Mail.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const permissions = sortByName(this.state.permissions, sort, 'username');

    this.setState({ permissions, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      user: INIT_USER,
      isModalProcessing: false,
      showModal: false
    });
  }

  /**
   * Handle the user E-Mail change.
   * @param {any} event - Event from the E-Mail select
   */
  handleEmailChange(event: any) {
    const userId = event.target.value;
    this.setState({
      user: { userId, username: '', version: 0 },
      isEmailValid: userId !== ''
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
                <Breadcrumb.Item active>{ getLocaleString('Permissions') }</Breadcrumb.Item>
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
                  <Button size="sm" variant="primary" onClick={this.addPermission}>{ getLocaleString('Add Permission') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
            {
              this.state.permissions.length === 0 && !this.state.isLoading &&
              <Jumbotron>
                <p>{ getLocaleString('No permission found.') }</p>
              </Jumbotron>
            }
            {
              this.state.permissions.length > 0 && !this.state.isLoading &&
              <Card className="custom-card-big">
                <Card.Body>
                  <Table striped bordered>
                    <thead>
                      <tr>
                        <th>{ getLocaleString('E-Mail') }</th>
                        <th>{ getLocaleString('Permissions') }</th>
                        <th colSpan={2}>{ getLocaleString('Actions') }</th>
                      </tr>
                    </thead>
                    <tbody>
                    {
                      this.state.permissions.filter((permission: IPermission) => permission.visible)
                        .map((permission: IPermission) => {
                          const user = {
                            userId: permission.userId,
                            username: permission.username,
                            version: permission.version
                          };

                          return (
                            <tr key={permission.userId}>
                              <td>{permission.username}</td>
                              <td>
                                <ul>
                                {
                                  permission.sites.map((site) => {
                                    const filteredAreas = permission.areas.filter((area) => area.parentId === site.id);
                                    if (filteredAreas.length > 0) {
                                      return (
                                        <li key={site.id}>
                                          {site.name}
                                          <ul key={site.id}>
                                          {
                                            filteredAreas.map((area) => {
                                              const filteredProcesses = permission.processes.filter((process) => process.parentId === area.id);
                                              const filteredStations = permission.stations.filter((station) => station.parentId === area.id);
                                              if (filteredProcesses.length > 0 || filteredStations.length > 0) {
                                                return (
                                                  <li key={area.id}>
                                                    {area.name}
                                                    <ul key={area.id}>
                                                    {
                                                      filteredProcesses.map((process) => {
                                                        return (
                                                          <li key={process.id}>{`${getLocaleString('Process Name')}: ${process.name}`}</li>
                                                        );
                                                      })
                                                    }
                                                    {
                                                      filteredStations.map((station) => {
                                                        const filteredDevices = permission.devices.filter((device) => device.parentId === station.id);
                                                        if (filteredDevices.length > 0) {
                                                          return (
                                                            <li key={station.id}>
                                                              {`${getLocaleString('Station Name')}: ${station.name}`}
                                                              <ul key={station.id}>
                                                              {
                                                                filteredDevices.map((device) => {
                                                                  return (
                                                                    <li key={device.id}>{device.name}</li>
                                                                  );
                                                                })
                                                              }
                                                              </ul>
                                                            </li>
                                                          )
                                                        } else {
                                                          return (
                                                            <li key={station.id}>{`${getLocaleString('Station Name')}: ${station.name}`}</li>
                                                          );
                                                        }
                                                      })
                                                    }
                                                    </ul>
                                                  </li>
                                                );
                                              } else {
                                                return (
                                                  <li key={area.id}>{area.name}</li>
                                                );
                                              }
                                            })
                                          }
                                          </ul>
                                        </li>
                                      );
                                    } else {
                                      return (
                                        <li key={site.id}>{site.name}</li>
                                      )
                                    }
                                  })
                                }
                                </ul>
                              </td>
                              <td>
                                <Button variant="primary" size="sm"
                                  onClick={() => this.editPermission(permission)}>{ getLocaleString('Edit') }</Button>
                              </td>
                              <td>
                                <Button variant="danger" size="sm"
                                  onClick={() => this.openModal(user)}>{ getLocaleString('Delete') }</Button>
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
            <Modal.Title>{ getLocaleString('Delete Permission') }</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { getLocaleString('Are you sure you want to delete this permission') }: <strong>{this.state.user.username}</strong>?
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
            <Button variant="danger" onClick={this.deletePermission} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
          </Modal.Footer>
          {
            this.state.isModalProcessing &&
            <ProgressBar animated now={100} />
          }
        </Modal>
      </div>
    );
  }
}

export default Permission;