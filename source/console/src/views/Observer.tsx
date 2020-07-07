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
import { API, graphqlOperation } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Jumbotron from 'react-bootstrap/Jumbotron';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

// Import graphql
import { onCreateIssue, onUpdateIssue } from '../graphql/subscriptions';
import { getEvent } from '../graphql/queries';
import { updateIssue } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, addISOTimeOffset, getLocaleString, makeAllVisible } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData, IIssue, ISelectedData } from '../components/Interfaces';
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
  issue?: IIssue;
  issues: IIssue[];
  sites: IGeneralQueryData[];
  areas: IGeneralQueryData[];
  selectedSite: ISelectedData;
  selectedArea: ISelectedData;
  isLoading: boolean;
  error: string;
  showIssue: boolean;
  showModal: boolean;
  rootCauses: string[];
  rootCause: string;
}

// Logging
const LOGGER = new Logger('Observer', LOGGING_LEVEL);

/**
 * The observer page
 * @class Observer
 */
class Observer extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create issue subscription
  private createIssueSubscription: any;
  // Update issue subscription
  private updateIssueSubscription: any;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      issues: [],
      sites: [],
      areas: [],
      selectedSite: { id: '', name: '' },
      selectedArea: { id: '', name: '' },
      isLoading: false,
      error: '',
      showIssue: false,
      showModal: false,
      rootCauses: [],
      rootCause: ''
    };

    this.graphQlCommon = new GraphQLCommon();

    this.closeIssue = this.closeIssue.bind(this);
    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.handleRootCauseChange = this.handleRootCauseChange.bind(this);
    this.handleUpdateIssue = this.handleUpdateIssue.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get sites at page load
    this.getSites();

    // Subscribe to new issues
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, showIssue } = this.state;
        const newIssue = response.value.data.onCreateIssue;
        newIssue.visible = true;

        if (showIssue && selectedSite.name === newIssue.siteName && selectedArea.name === newIssue.areaName) {
          const updatedIssues = [...issues, newIssue];
          this.setState({ issues: updatedIssues });

          this.props.handleNotification(`New issue was created at ${newIssue.deviceName}`, 'info', 5);
        }
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to update issues
    this.updateIssueSubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, showIssue } = this.state;
        let updatedIssue = response.value.data.onUpdateIssue;

        if (showIssue && selectedSite.name === updatedIssue.siteName && selectedArea.name === updatedIssue.areaName) {
          updatedIssue.visible = ('acknowledged' === updatedIssue.status);

          const issueIndex = issues.findIndex(issue => issue.id === updatedIssue.id);
          const updatedIssues = [
            ...issues.slice(0, issueIndex),
            updatedIssue,
            ...issues.slice(issueIndex + 1)
          ];

          this.setState({ issues: updatedIssues });
        }
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    })
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    this.updateIssueSubscription.unsubscribe();
    this.createIssueSubscription.unsubscribe();
  }

  /**
   * Get sites
   */
  async getSites() {
    try {
      const sites: IGeneralQueryData[] = await this.graphQlCommon.listSites();

      if (sites.length === 1) {
        const selectedSite = {
          id: sites[0].id,
          name: sites[0].name
        };

        this.setState({
          selectedSite,
          selectedArea: { id: '', name: '' }
        });
        this.getAreas(selectedSite);
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ sites });
    } catch (error) {
      LOGGER.error('Error while getting sites', error);
      this.setState({ error: getLocaleString('Error occurred while getting sites.') });
    }
  }

  /**
   * Get areas
   * @param {object} selectedSite - Selected site
   */
  async getAreas(selectedSite: ISelectedData) {
    try {
      // Graphql operation to get areas
      const siteId = selectedSite.id;
      const areas: IGeneralQueryData[] = await this.graphQlCommon.listAreas(siteId as string);

      if (areas.length === 1) {
        const selectedArea = {
          id: areas[0].id,
          name: areas[0].name
        };

        this.setState({ selectedArea });
        this.getIssues(selectedSite, selectedArea);
      }

      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ areas });
    } catch (error) {
      LOGGER.error('Error while getting areas', error);
      this.setState({ error: getLocaleString('Error occurred while getting areas.') });
    }
  }

  /**
   * Get issues by the site and the area
   * @param {object} selectedSite - Selected site
   * @param {object} selectedArea - Selected area
   */
  async getIssues(selectedSite: ISelectedData, selectedArea: ISelectedData) {
    if (selectedSite.name === '' || selectedArea.name === '') {
      return;
    }

    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const selectedSiteName = selectedSite.name;
      const selectedAreaName = selectedArea.name;

      // Get open issues
      const input = {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: {
          beginsWith: {
            areaName: selectedAreaName,
            status: 'open'
          }
        },
        limit: 20
      };
      let issues: IIssue[] = await this.graphQlCommon.listIssuesBySiteAreaStatus(input);

      // Get acknowledged issues
      input.areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated.beginsWith.status = 'acknowledged';
      issues = [
        ...issues,
        ...await this.graphQlCommon.listIssuesBySiteAreaStatus(input)
      ];

      // Make all issues visible.
      makeAllVisible(issues);

      issues.sort((a, b) => a.status.localeCompare(b.status));
      this.setState({
        issues,
        showIssue: true
      });
    } catch (error) {
      LOGGER.error('Error while getting issues', error);
      this.setState({ error: getLocaleString('Error occurred while getting issues.') });
    }

    this.setState({ isLoading: false })
  }

  /**
   * Close the issue with the root cause.
   */
  closeIssue() {
    const issue = this.state.issue;

    this.setState({
      showModal: false,
      rootCauses: []
    }, async () => {
      if (issue) {
        const { rootCause } = this.state;
        if (rootCause && rootCause !== '') {
          issue.rootCause = rootCause;
        }

        await this.handleUpdateIssue(issue, 'closed');
      }
    });
  }

  /**
   * Handle site select change event.
   * @param {any} event - Event from the site select
   */
  handleSiteChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedSite = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setState({
      selectedSite,
      selectedArea: { id: '', name: ''},
      issues: [],
      showIssue: false
    });

    this.getAreas(selectedSite);
  }

  /**
   * Handle area select change event.
   * @param {any} event - Event from the area select
   */
  handleAreaChange(event: any) {
    const { selectedSite } = this.state;
    const index = event.target.options.selectedIndex;
    const selectedArea = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setState({
      selectedArea,
      issues: [],
      showIssue: false
    });

    this.getIssues(selectedSite, selectedArea);
  }

  /**
   * Handle root cause change event.
   * @param {any} event - Event from the root cause input
   */
  handleRootCauseChange(event: any) {
    const rootCause = event.target.value;
    this.setState({ rootCause });
  }

  /**
   * Handle issue update.
   * @param {IIssue} issue - Issue to update
   * @param {string} status - Issue new status
   */
  async handleUpdateIssue(issue: IIssue, status: string) {
    try {
      issue.status = status;
      issue.expectedVersion = issue.version;
      const newVersion = issue.version + 1;
      delete issue.version;
      delete issue.visible;

      if (status === 'closed') {
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = Math.ceil((new Date(issue.closed).valueOf() - new Date(issue.created).valueOf()) / 1000);
      } else if (status === 'rejected') {
        // If the issue is rejected, resolution time would be 0.
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = 0;
      } else if (status === 'acknowledged') {
        issue.acknowledged = addISOTimeOffset(new Date());
        issue.acknowledgedTime = Math.ceil((new Date(issue.acknowledged).valueOf() - new Date(issue.created).valueOf()) / 1000);
      }

      const input = issue;
      await API.graphql(graphqlOperation(updateIssue, { input }));
      this.props.handleNotification(`${getLocaleString('Issue')}: ${issue.eventDescription}, ${getLocaleString('Device')}: ${issue.deviceName}, ${getLocaleString('Status')}: ${status}`, 'info', 5);

      if (!['rejected', 'closed'].includes(status)) {
        issue.visible = true;
      }
      issue.version = newVersion;
    } catch (error) {
      LOGGER.error(error);
      this.props.handleNotification(getLocaleString('Error occurred while updating the issue.'), 'error', 5);
    }
  }

  /**
   * Handle closing an issue.
   * @param {IIssue} issue - Issue to close
   */
  async handleClose(issue: IIssue) {
    // Get event
    const { eventId } = issue;

    const response = await API.graphql(graphqlOperation(getEvent, { id: eventId }));
    const rootCauses: string[] = response.data.getEvent.rootCauses ? response.data.getEvent.rootCauses : [];

    this.setState({
      issue,
      rootCauses: rootCauses.sort((a, b) => a.localeCompare(b)),
      showModal: true,
      rootCause: ''
    });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      issue: undefined,
      showModal: false,
      rootCauses: [],
      rootCause: ''
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
                <Breadcrumb.Item active>{ getLocaleString('Observer') }</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} md={6} controlId="siteSelect">
                        <Form.Label>{ getLocaleString('Select the site where you want to view the issues') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedSite.name} onChange={this.handleSiteChange}>
                          <option data-key="" key="none-site" value="">{ getLocaleString('Select Site') }</option>
                          {
                            this.state.sites.map((site: IGeneralQueryData) => {
                              return (
                                <option data-key={site.id} key={site.id} value={site.name}>{site.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} md={6} controlId="areaSelect">
                        <Form.Label>{ getLocaleString('Select the work area where you want to view the issues') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="">{ getLocaleString('Select Area') }</option>
                          {
                            this.state.areas.map((area: IGeneralQueryData) => {
                              return (
                                <option data-key={area.id} key={area.id} value={area.name}>{area.name}</option>
                              );
                            })
                          }
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
            {
              this.state.showIssue && this.state.issues.filter(issue => issue.visible).length === 0 && !this.state.isLoading &&
              <Jumbotron>
                <p>{ getLocaleString('No issues open currently at this site / area.') }</p>
              </Jumbotron>
            }
            {
              this.state.issues.filter(issue => issue.visible).length > 0 &&
              <Card className="custom-card-big">
                <Row>
                {
                  this.state.issues.filter((issue: IIssue) => issue.visible)
                    .map((issue: IIssue) => {
                      return (
                        <Col xs={6} sm={4} md={4} key={issue.id}>
                          <Card className="custom-card-issue">
                            <Card.Header>
                              <p><strong>{issue.eventDescription}</strong></p>
                              <p>{issue.deviceName} - {issue.stationName}</p>
                            </Card.Header>
                            <Card.Body>
                              <Card.Title>
                                <h6>{ getLocaleString('Process Name') } - {issue.processName}</h6>
                              </Card.Title>
                              <Form>
                                {
                                  issue.status === 'open' &&
                                  <Form.Row className="justify-content-between">
                                    <Button variant="success" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'acknowledged')}>{ getLocaleString('Acknowledge') }</Button>
                                    <Button variant="secondary" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'rejected')}>{ getLocaleString('Reject') }</Button>
                                  </Form.Row>
                                }
                                {
                                  issue.status === 'acknowledged' &&
                                  <Button variant="warning" size="sm" onClick={async () => this.handleClose(issue)}>{ getLocaleString('Close') }</Button>
                                }
                              </Form>
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })
                }
                </Row>
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
            <Modal.Title>{ getLocaleString('Closing Issue') }</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group controlId="rootCause">
                <Form.Label>{ getLocaleString('Root Cause') }</Form.Label>
                <Form.Control as="select" defaultValue={this.state.rootCause} onChange={this.handleRootCauseChange}>
                  <option value="">{ getLocaleString('Choose the root cause') }</option>
                  {
                    this.state.rootCauses && this.state.rootCauses.map((rootCause: string) => {
                      return(
                        <option key={rootCause} value={rootCause}>{rootCause}</option>
                      );
                    })
                  }
                </Form.Control>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
            <Button variant="primary" onClick={this.closeIssue}>{ getLocaleString('Submit') }</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Observer;