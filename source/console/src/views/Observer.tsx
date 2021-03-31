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
import { API, graphqlOperation, I18n } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
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
import { LOGGING_LEVEL, addISOTimeOffset, makeAllVisible } from '../util/CustomUtil';
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
    // @ts-ignore
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response: any) => {
        const { issues, selectedSite, selectedArea, showIssue } = this.state;
        const newIssue = response.value.data.onCreateIssue;
        newIssue.visible = true;

        if (showIssue && selectedSite.name === newIssue.siteName && selectedArea.name === newIssue.areaName) {
          const updatedIssues = [...issues, newIssue];
          this.setState({ issues: updatedIssues });

          this.props.handleNotification(`${I18n.get('text.issue')}: ${newIssue.deviceName}`, 'info', 5);
        }
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to update issues
    // @ts-ignore
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
    if (this.updateIssueSubscription) this.updateIssueSubscription.unsubscribe();
    if (this.createIssueSubscription) this.createIssueSubscription.unsubscribe();
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
      this.setState({ error: I18n.get('error.get.sites') });
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
      this.setState({ error: I18n.get('error.get.areas') });
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
      this.setState({ error: I18n.get('error.get.issues') });
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
      // @ts-ignore
      delete issue.version;
      delete issue.visible;

      let translatedStatus = '';
      if (status === 'closed') {
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = Math.ceil((new Date(issue.closed).valueOf() - new Date(issue.created).valueOf()) / 1000);
        translatedStatus = I18n.get('text.status.close');
      } else if (status === 'rejected') {
        // If the issue is rejected, resolution time would be 0.
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = 0;
        translatedStatus = I18n.get('text.status.reject');
      } else if (status === 'acknowledged') {
        issue.acknowledged = addISOTimeOffset(new Date());
        issue.acknowledgedTime = Math.ceil((new Date(issue.acknowledged).valueOf() - new Date(issue.created).valueOf()) / 1000);
        translatedStatus = I18n.get('text.status.acknowledge');
      }

      const input = issue;
      await API.graphql(graphqlOperation(updateIssue, { input }));
      this.props.handleNotification(`${I18n.get('text.issue')}: ${issue.eventDescription}, ${I18n.get('text.device')}: ${issue.deviceName}, ${I18n.get('text.status')}: ${translatedStatus}`, 'info', 5);

      if (!['rejected', 'closed'].includes(status)) {
        issue.visible = true;
      }
      issue.version = newVersion;
    } catch (error) {
      LOGGER.error(error);
      this.props.handleNotification(I18n.get('error.update.issue'), 'error', 5);
    }
  }

  /**
   * Handle closing an issue.
   * @param {IIssue} issue - Issue to close
   */
  async handleClose(issue: IIssue) {
    // Get event
    const { eventId } = issue;

    const response = await API.graphql(graphqlOperation(getEvent, { id: eventId })) as GraphQLResult;
    const data: any = response.data;
    const rootCauses: string[] = data.getEvent.rootCauses ? data.getEvent.rootCauses : [];

    if (rootCauses.length > 0) {
      rootCauses.sort((a, b) => a.localeCompare(b));
      this.setState({
        issue,
        rootCauses,
        showModal: true,
        rootCause: ''
      });
    } else {
      await this.handleUpdateIssue(issue, 'closed');
    }
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
                <Breadcrumb.Item active>{ I18n.get('menu.observer') }</Breadcrumb.Item>
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
                        <Form.Label>{ I18n.get('text.select.site.issues') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedSite.name} onChange={this.handleSiteChange}>
                          <option data-key="" key="none-site" value="">{ I18n.get('text.select.site') }</option>
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
                        <Form.Label>{ I18n.get('text.select.area.issues') }</Form.Label>
                        <Form.Control as="select" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="">{ I18n.get('text.select.area') }</option>
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
                <p>{ I18n.get('text.no.issues.currently') }</p>
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
                                <h6>{ I18n.get('text.process.name') } - {issue.processName}</h6>
                              </Card.Title>
                              <Form>
                                {
                                  issue.status === 'open' &&
                                  <Form.Row className="justify-content-between">
                                    <Button variant="success" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'acknowledged')}>{ I18n.get('button.acknowledge') }</Button>
                                    <Button variant="secondary" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'rejected')}>{ I18n.get('button.reject') }</Button>
                                  </Form.Row>
                                }
                                {
                                  issue.status === 'acknowledged' &&
                                  <Button variant="warning" size="sm" onClick={async () => this.handleClose(issue)}>{ I18n.get('button.close') }</Button>
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
                  <strong>{ I18n.get('error') }:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{ I18n.get('text.closing.issue') }</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group controlId="rootCause">
                <Form.Label>{ I18n.get('text.rootcause') }</Form.Label>
                <Form.Control as="select" defaultValue={this.state.rootCause} onChange={this.handleRootCauseChange}>
                  <option value="">{ I18n.get('text.choose.rootcause') }</option>
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
            <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
            <Button variant="primary" onClick={this.closeIssue}>{ I18n.get('button.submit') }</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Observer;