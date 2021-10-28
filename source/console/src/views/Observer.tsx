// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { API, graphqlOperation, I18n, Auth } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { Logger } from '@aws-amplify/core';
import { RouteComponentProps } from 'react-router';

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
import { LOGGING_LEVEL, addISOTimeOffset, convertSecondsToHms, makeAllVisible, handleSubscriptionError } from '../util/CustomUtil';
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
  location?: any;
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
  comment: string;
}

/**
 * Types of subscriptions that will be maintained by the main Observer class
 */
export enum ObserverSubscriptionTypes {
  CREATE_ISSUE,
  UPDATE_ISSUE
}

// Logging
const LOGGER = new Logger('Observer', LOGGING_LEVEL);

/**
 * The observer page
 * @class Observer
 */
class Observer extends React.Component<IProps, IState, RouteComponentProps> {
  // Username
  private username: string;
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
      rootCause: '',
      comment: ''
    };

    this.graphQlCommon = new GraphQLCommon();

    this.closeIssue = this.closeIssue.bind(this);
    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.handleRootCauseChange = this.handleRootCauseChange.bind(this);
    this.handleUpdateIssue = this.handleUpdateIssue.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.calculateTimeSinceIssueCreated = this.calculateTimeSinceIssueCreated.bind(this);
    this.configureSubscription = this.configureSubscription.bind(this);
    this.username = '';
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get user information
    await this.getUser();

    // Get sites at page load
    this.getSites();

    // Configure subscriptions
    await this.configureSubscription(ObserverSubscriptionTypes.CREATE_ISSUE);
    await this.configureSubscription(ObserverSubscriptionTypes.UPDATE_ISSUE);
  }

  /**
   * Configures the subscription for the supplied `subscriptionType`
   * @param subscriptionType The type of subscription to configure
   * @param delayMS (Optional) This value will be used to set a delay for reestablishing the subscription if the socket connection is lost
   */
  async configureSubscription(subscriptionType: ObserverSubscriptionTypes, delayMS: number = 10): Promise<void> {
    try {
      switch (subscriptionType) {
        case ObserverSubscriptionTypes.CREATE_ISSUE:
          if (this.createIssueSubscription) { this.createIssueSubscription.unsubscribe(); }

          // @ts-ignore
          this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
            next: (response: any) => {
              const { issues, selectedSite, selectedArea, showIssue } = this.state;
              const newIssue = response.value.data.onCreateIssue;
              newIssue.visible = true;

              if (showIssue && selectedSite.name === newIssue.siteName && (selectedArea.name === newIssue.areaName || selectedArea.name === "all")) {
                const updatedIssues = [...issues, newIssue];
                this.setState({ issues: updatedIssues });

                this.props.handleNotification(`${I18n.get('text.issue')}: ${newIssue.deviceName}`, 'info', 5);
              }
            },
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
        case ObserverSubscriptionTypes.UPDATE_ISSUE:
          if (this.updateIssueSubscription) { this.updateIssueSubscription.unsubscribe(); }

          // @ts-ignore
          this.updateIssueSubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
            next: (response: any) => {
              const { issues, selectedSite, selectedArea, showIssue } = this.state;
              let updatedIssue = response.value.data.onUpdateIssue;

              if (showIssue && selectedSite.name === updatedIssue.siteName && (selectedArea.name === updatedIssue.areaName || selectedArea.name === 'all')) {
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
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          })
          break;
      }
    } catch (err) {
      console.error('Unable to configure subscription', err);
    }
  }

  /**
   * Get the current user.
   */
  async getUser() {
    const user = await Auth.currentAuthenticatedUser();
    this.username = user.username;
  }

  componentDidUpdate(prevProps: IProps, prevState: IState) {
    const queryParams = new URLSearchParams(this.props.location.search);
    let newQueryValue;
    let queryKeyToUpdate = "";
    let selectKeysPrefix = "selected"
    let key: keyof IState

    for (key in this.state) {
      if (key.startsWith(selectKeysPrefix) && prevState[key] !== this.state[key]) {
        newQueryValue = (this.state[key] as ISelectedData).id;
        queryKeyToUpdate = key.slice(selectKeysPrefix.length, key.length).toLowerCase();
      }
    }

    if (queryKeyToUpdate !== "" && newQueryValue !== undefined) {
      queryParams.set(queryKeyToUpdate, newQueryValue);
      this.props.history.replace({ search: `?${queryParams.toString()}` });
    }
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
      const search = new URLSearchParams(this.props.location.search);
      const searchedSiteId = search.get("site");

      if (sites.length === 1 || searchedSiteId) {
        const searchedSite = sites.filter((site) => site.id === searchedSiteId);

        const selectedSite = {
          id: searchedSite.length > 0 ? searchedSite[0].id : sites[0].id,
          name: searchedSite.length > 0 ? searchedSite[0].name : sites[0].name
        }

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
      const search = new URLSearchParams(this.props.location.search);
      const searchedAreaId = search.get("area");
      const searchedArea = areas.filter((area) => area.id === searchedAreaId);

      const selectedArea = searchedArea.length > 0 ? { id: searchedArea[0].id, name: searchedArea[0].name } : { id: "all", name: "all" };

      this.setState({ selectedArea });
      this.getIssues(selectedSite, selectedArea);


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
      let filter = selectedAreaName === "all" && { filter: { status: { eq: "open" } } }
      const input = {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: {
          beginsWith: {
            areaName: selectedAreaName,
            status: 'open'
          }
        },
        limit: 20,
        ...filter
      };
      let issues: IIssue[] = await this.graphQlCommon.listIssuesBySiteAreaStatus(input);
      if (input.filter) input.filter.status.eq = "acknowledged";
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
        const { rootCause, comment } = this.state;
        if (rootCause && rootCause !== '') {
          issue.rootCause = rootCause;
          if (comment && comment !== '') issue.comment = comment;
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
        issue.closedBy = this.username;
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = Math.ceil((new Date(issue.closed).valueOf() - new Date(issue.created).valueOf()) / 1000);
        translatedStatus = I18n.get('text.status.close');
      } else if (status === 'rejected') {
        // If the issue is rejected, resolution time would be 0.
        issue.closed = addISOTimeOffset(new Date());
        issue.resolutionTime = 0;
        translatedStatus = I18n.get('text.status.reject');
        issue.rejectedBy = this.username;
      } else if (status === 'acknowledged') {
        issue.acknowledgedBy = this.username;
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
    const rootCauses: string[] = data.getEvent?.rootCauses || [];

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
 * Calculate time passed since the issue was created
 * @param {string} issueCreatedTime - The time the issue was created in UTC
 * @return {string} the hours passed since the issue was created.
 */
  calculateTimeSinceIssueCreated(issueCreatedTime: string) {
    const currentTime = new Date().getTime();
    const timeElapsedInMilliseconds = currentTime - new Date(issueCreatedTime).getTime();
    const timeElapsedInSeconds = timeElapsedInMilliseconds / 1000;
    const timeElapsedAsString = convertSecondsToHms(timeElapsedInSeconds);
    let [largestUnitOfTimeValue, largestUnitOfTimeLabel] = timeElapsedAsString.split(' ');
    if (Number(largestUnitOfTimeValue) < 1) largestUnitOfTimeValue = "< 1";

    return `${largestUnitOfTimeValue} ${largestUnitOfTimeLabel}`;
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
                <Breadcrumb.Item active>{I18n.get('menu.observer')}</Breadcrumb.Item>
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
                        <Form.Label>{I18n.get('text.select.site.issues')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedSite.name} onChange={this.handleSiteChange}>
                          <option data-key="" key="none-site" value="" disabled>{I18n.get('text.select.site')}</option>
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
                        <Form.Label>{I18n.get('text.select.area.issues')}</Form.Label>
                        <Form.Control as="select" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="" disabled>{I18n.get('text.select.area')}</option>
                          {
                            this.state.selectedSite.name !== "" && <option data-key="all" key="all" value="all">{I18n.get('text.select.area.all')}</option>
                          }
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
                  <p>{I18n.get('text.no.issues.currently')}</p>
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
                                  <p>{this.calculateTimeSinceIssueCreated(issue.createdAt)}</p>
                                </Card.Header>
                                <Card.Body>
                                  <Card.Title>
                                    <h6>{I18n.get('text.process.name')} - {issue.processName}</h6>
                                  </Card.Title>
                                  <Form>
                                    {
                                      issue.status === 'open' &&
                                      <Form.Row className="justify-content-between">
                                        <Button variant="success" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'acknowledged')}>{I18n.get('button.acknowledge')}</Button>
                                        <Button variant="secondary" size="sm" onClick={async () => this.handleUpdateIssue(issue, 'rejected')}>{I18n.get('button.reject')}</Button>
                                      </Form.Row>
                                    }
                                    {
                                      issue.status === 'acknowledged' &&
                                      <Button variant="warning" size="sm" onClick={async () => this.handleClose(issue)}>{I18n.get('button.close')}</Button>
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
                  <strong>{I18n.get('error')}:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{I18n.get('text.closing.issue')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group controlId="rootCause">
                <Form.Label>{I18n.get('text.rootcause')}</Form.Label>
                <Form.Control as="select" defaultValue={this.state.rootCause} onChange={this.handleRootCauseChange}>
                  <option value="">{I18n.get('text.choose.rootcause')}</option>
                  {
                    this.state.rootCauses && this.state.rootCauses.map((rootCause: string) => {
                      return (
                        <option key={rootCause} value={rootCause}>{rootCause}</option>
                      );
                    })
                  }
                </Form.Control>
              </Form.Group>
              {this.state.rootCause !== "" &&
                <Form.Group>
                  <Form.Label>{I18n.get('text.choose.rootcause.comment')}</Form.Label>
                  <Form.Control as='textarea' rows={3} name="comment" maxLength={500}
                    onChange={(event) => this.setState({ comment: event.target.value })}
                  >
                  </Form.Control>
                  <Form.Text className="text-muted">
                    {this.state.comment.length}/500
                  </Form.Text>
                </Form.Group>
              }
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
            <Button variant="primary" onClick={this.closeIssue}>{I18n.get('button.submit')}</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Observer;