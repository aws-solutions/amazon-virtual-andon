// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Jumbotron from 'react-bootstrap/Jumbotron';
import ProgressBar from 'react-bootstrap/ProgressBar';

// Import graphql
import { onCreateIssue, onUpdateIssue } from '../graphql/subscriptions';

// Import custom setting
import { LOGGING_LEVEL, addISOTimeOffset, convertSecondsToHms, handleSubscriptionError } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData, IIssue, ISelectedData } from '../components/Interfaces';
import EmptyRow from '../components/EmptyRow';
import DataTable from '../components/DataTable';
import { SortBy } from '../components/Enums';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  issues: IIssue[];
  sites: IGeneralQueryData[];
  areas: IGeneralQueryData[];
  selectedSite: ISelectedData;
  selectedArea: ISelectedData;
  isLoading: boolean;
  error: string;
  showIssue: boolean;
  dataVersion: number;
}

/**
 * Types of subscriptions that will be maintained by the main History class
 */
export enum HistorySubscriptionTypes {
  CREATE_ISSUE,
  UPDATE_ISSUE
}

// Logging
const LOGGER = new Logger('History', LOGGING_LEVEL);

/**
 * The history page
 * @class History
 */
class History extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create issue subscription
  private createIssueSubscription: any;
  // Update issue subscription
  private updateIssuesubscription: any;

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
      dataVersion: 1
    };

    this.graphQlCommon = new GraphQLCommon();

    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.configureSubscription = this.configureSubscription.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get sites at page load
    this.getSites();

    // Configure subscriptions
    await this.configureSubscription(HistorySubscriptionTypes.CREATE_ISSUE);
    await this.configureSubscription(HistorySubscriptionTypes.UPDATE_ISSUE);
  }

  /**
   * Configures the subscription for the supplied `subscriptionType`
   * @param subscriptionType The type of subscription to configure
   * @param delayMS (Optional) This value will be used to set a delay for reestablishing the subscription if the socket connection is lost
   */
  async configureSubscription(subscriptionType: HistorySubscriptionTypes, delayMS: number = 10): Promise<void> {
    try {
      switch (subscriptionType) {
        case HistorySubscriptionTypes.CREATE_ISSUE:
          if (this.createIssueSubscription) { this.createIssueSubscription.unsubscribe(); }

          // @ts-ignore
          this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
            next: (response: any) => {
              const newIssue = response.value.data.onCreateIssue;
              const { issues } = this.state;
              const updatedIssues = [...issues, newIssue];

              this.setState((prevState) => ({
                issues: updatedIssues,
                dataVersion: prevState.dataVersion + 1
              }));
            },
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
        case HistorySubscriptionTypes.UPDATE_ISSUE:
          if (this.updateIssuesubscription) { this.updateIssuesubscription.unsubscribe(); }

          // @ts-ignore
          this.updateIssuesubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
            next: (response: any) => {
              const { issues } = this.state;
              const updatedIssue = response.value.data.onUpdateIssue;
              const index = issues.findIndex(issue => issue.id === updatedIssue.id);
              const updatedIssues = [
                ...issues.slice(0, index),
                updatedIssue,
                ...issues.slice(index + 1)
              ];

              this.setState((prevState) => ({
                issues: updatedIssues,
                dataVersion: prevState.dataVersion + 1
              }));
            },
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
      }
    } catch (err) {
      console.error('Unable to configure subscription', err);
    }
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    if (this.updateIssuesubscription) this.updateIssuesubscription.unsubscribe();
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

        this.setState({ selectedSite });
        this.getAreas(selectedSite);
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ sites });
    } catch (error) {
      LOGGER.error('Error while getting sites.', error);
      this.setState({ error: I18n.get('error.get.sites') });
    }
  }

  /**
   * Get areas
   * @param {object} selectedSite - Selected site
   */
  async getAreas(selectedSite: ISelectedData) {
    try {
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
      LOGGER.error('Error while getting areas.', error);
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
      let lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const input: any = {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName } },
        filter: { created: { gt: addISOTimeOffset(lastWeek) } },
        limit: 40
      };
      const issues: IIssue[] = await this.graphQlCommon.listIssuesBySiteAreaStatus(input);

      this.setState({ issues });
    } catch (error) {
      LOGGER.error('Error while getting issues', error);
      this.setState({ error: I18n.get('error.get.issues') });
    }

    this.setState({
      isLoading: false,
      showIssue: true
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
      selectedArea: { id: '', name: '' },
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
      showIssue: false
    });
    this.getIssues(selectedSite, selectedArea);
  }

  /**
   * Render this page.
   */
  render() {
    const headers = [
      { name: I18n.get('text.event.description'), key: 'eventDescription' },
      { name: I18n.get('text.process.name'), key: 'processName' },
      { name: I18n.get('text.device.name'), key: 'deviceName' },
      { name: I18n.get('text.status'), key: 'status' },
      { name: I18n.get('text.rootcause'), key: 'rootCause' },
      { name: I18n.get('text.comment'), key: 'comment' },
      { name: I18n.get('text.created.at'), key: 'created' },
      { name: I18n.get('text.closed.at'), key: 'closed' },
      { name: I18n.get('text.resolution.time'), key: 'resolutionTime', callFunction: convertSecondsToHms, keyType: 'number' }
    ];

    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{I18n.get('text.history')}</Breadcrumb.Item>
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
          {
            this.state.issues.length > 0 && !this.state.isLoading &&
            <div>
              <EmptyRow />
              <Row>
                <Col>
                  <Form>
                    <Form.Row className="justify-content-end">
                      <CSVLink data={this.state.issues} className="btn btn-primary btn-sm">{I18n.get('button.download.csv.data')}</CSVLink>
                    </Form.Row>
                  </Form>
                </Col>
              </Row>
            </div>
          }
          <EmptyRow />
          <Row>
            <Col>
              {
                this.state.showIssue && this.state.issues.length === 0 && !this.state.isLoading &&
                <Jumbotron>
                  <p>{I18n.get('text.no.issues.seven.days')}</p>
                </Jumbotron>
              }
              {
                this.state.issues.length > 0 && !this.state.isLoading &&
                <Card className="custom-card-big custom-card-header-warning">
                  <Card.Header><strong>{I18n.get('text.history.last.seven.days')}</strong></Card.Header>
                  <Card.Body>
                    <DataTable headers={headers} data={this.state.issues} initialSort={{ key: 'created', order: SortBy.Asc }} dataVersion={this.state.dataVersion} />
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
                  <strong>{I18n.get('error')}:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
      </div>
    );
  }
}

export default History;