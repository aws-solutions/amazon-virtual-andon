// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
// Import React and Amplify packages
import React from 'react';
import ChartistGraph from 'react-chartist';
import { I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import ProgressBar from 'react-bootstrap/ProgressBar';

// Import custom setting
import { LOGGING_LEVEL, addISOTimeOffset, getPreviousDays, convertSecondsToHms } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData, IIssue, ITopIssue, ISelectedData } from '../components/Interfaces';
import { SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';
import DataTable from '../components/DataTable';
import chartist from 'chartist';

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
  topIssues: ITopIssue[];
  sites: IGeneralQueryData[];
  areas: IGeneralQueryData[];
  selectedSite: ISelectedData;
  selectedArea: ISelectedData;
  isLoading: boolean;
  error: string;
  sumOfResolutionTimeIssues: number|string;
  showMetrics: boolean;
  last24Hours: any;
  last24HoursOptions: any;
  last7Days: any;
  last7DaysOptions: any;
}

// Logging
const LOGGER = new Logger('Metrics', LOGGING_LEVEL);

/**
 * The metrics page
 * @class Metrics
 */
class Metrics extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      issues: [],
      topIssues: [],
      sites: [],
      areas: [],
      selectedSite: { id: '', name: '' },
      selectedArea: { id: '', name: '' },
      isLoading: false,
      error: '',
      sumOfResolutionTimeIssues: '',
      showMetrics: false,
      last24Hours: {},
      last24HoursOptions: {},
      last7Days: {},
      last7DaysOptions: {}
    };

    this.graphQlCommon = new GraphQLCommon();

    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get sites at page load
    this.getSites();
  }

  /**
   * Get sites
   */
  async getSites() {
    try {
      const sites: IGeneralQueryData[] = await this.graphQlCommon.listSites();

      if (sites.length === 1) {
        const selectedSite = {
          id: sites[0]['id'],
          name: sites[0]['name']
        };

        this.setState({ selectedSite });
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
      const siteId = selectedSite.id;
      const areas: IGeneralQueryData[] = await this.graphQlCommon.listAreas(siteId as string);

      if (areas.length === 1) {
        const selectedArea = {
          id: areas[0]['id'],
          name: areas[0]['name']
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
      let lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const input: any = {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName } },
        filter: { created: { gt: addISOTimeOffset(lastWeek) } },
        limit: 40
      };
      const issues: IIssue[] = await this.graphQlCommon.listIssuesBySiteAreaStatus(input);

      this.setState({
        issues,
        showMetrics: false
      });
      this.getMetrics(issues);
    } catch (error) {
      LOGGER.error('Error while getting issues', error);
      this.setState({ error: I18n.get('error.get.issues') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get metrics of issues.
   * @param {IIssue[]} issues - Issues to get metrics
   */
  getMetrics(issues: IIssue[]) {
    try {
      const today = new Date();
      let last7DaysLabels = [];
      let last7DaysDataInner = [];
      let yesterdayEndDate = today;
      let yesterdayEnd = addISOTimeOffset(today);
      let yesterdayStart = addISOTimeOffset(getPreviousDays(today, 0, 0, 0, 0, 0));
      let sumOfResolutionTimeIssues: string|number = 0;

      for (let index = 1; index <= 8; index++) {
        let last7DaysIssues = issues.filter((issue: IIssue) => issue.created > yesterdayStart && issue.created < yesterdayEnd);
        last7DaysDataInner.push(last7DaysIssues.length);

        let sumResolutionTime = 0;
        last7DaysIssues.forEach((issue: IIssue) => {
          if (issue.resolutionTime !== null) {
            sumResolutionTime += issue.resolutionTime;
          }
        });
        sumOfResolutionTimeIssues = sumOfResolutionTimeIssues + sumResolutionTime;

        let dateLabel = new Date(yesterdayEndDate).getDate();
        last7DaysLabels.push(dateLabel);
        yesterdayStart = addISOTimeOffset(getPreviousDays(today, -index, 0, 0, 0, 0));
        yesterdayEnd = addISOTimeOffset(getPreviousDays(today, -index, 23, 59, 59, 59));
        yesterdayEndDate = getPreviousDays(today, -index, 23, 59, 59, 59);
      }

      sumOfResolutionTimeIssues = sumOfResolutionTimeIssues === 0 ? '' : convertSecondsToHms(sumOfResolutionTimeIssues);

      const last7Days = {
        labels: [...last7DaysLabels].reverse(),
        series: [[...last7DaysDataInner].reverse()]
      };

      const last7DaysOptions = {
        lineSmooth: chartist.Interpolation.cardinal({
          tension: 0
        }),
        low: 0,
        showArea: true,
        high: Math.max(...last7DaysDataInner) + 0.1 * Math.max(...last7DaysDataInner),
        chartPadding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      };

      // Calculating the count of issues for the last 24 hours
      let last24HoursEndDate = new Date(today);
      let last24HoursStartDate = new Date(today);
      last24HoursStartDate.setHours(last24HoursStartDate.getHours() - 3);

      let last24HoursLabels = [];
      let last24HoursDataInner = [];
      let last24HoursEnd = addISOTimeOffset(last24HoursEndDate);
      let last24HoursStart = addISOTimeOffset(last24HoursStartDate);

      // For loop to divide 24 hours into 3 hours metrics
      for (let index = 0; index <= 8; index++) {
        let last24HoursIssues = issues.filter((issue: IIssue) => issue.created > last24HoursStart && issue.created < last24HoursEnd);
        last24HoursDataInner.push(last24HoursIssues.length);

        let hour =last24HoursEndDate.getHours();
        let convertedHour = hour % 12 || 12;
        let amPm = (hour < 12 || hour === 24) ? 'AM' : 'PM';
        let convertedLabel = `${convertedHour}${amPm}`;
        last24HoursLabels.push(convertedLabel);
        last24HoursEndDate = new Date(last24HoursStartDate);
        last24HoursEnd = addISOTimeOffset(last24HoursEndDate);
        last24HoursStartDate.setHours(last24HoursStartDate.getHours() - 3);
        last24HoursStart = addISOTimeOffset(last24HoursStartDate);
      }

      const last24Hours = {
        labels: [...last24HoursLabels].reverse(),
        series: [[...last24HoursDataInner].reverse()]
      };
      const last24HoursOptions = {
        lineSmooth: chartist.Interpolation.cardinal({
          tension: 0
        }),
        low: 0,
        showArea: true,
        high: Math.max(...last24HoursDataInner) + 0.1 * Math.max(...last24HoursDataInner),
        chartPadding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      };

      let topIssues: ITopIssue[] = [];
      for (let issue of issues) {
        if (topIssues.length > 0) {
          let topIssueIndex = topIssues.findIndex((topIssue: ITopIssue) => topIssue.processName === issue.processName && topIssue.eventDescription === issue.eventDescription);
          if (topIssueIndex >= 0) {
            topIssues[topIssueIndex].count = topIssues[topIssueIndex].count + 1;
            topIssues[topIssueIndex].totalResolutionSeconds = topIssues[topIssueIndex].totalResolutionSeconds + issue.resolutionTime;
          } else {
            topIssues.push({
              processName: issue.processName,
              eventDescription: issue.eventDescription,
              count: 1,
              totalResolutionSeconds: issue.resolutionTime
            });
          }
        } else {
          topIssues.push({
            processName: issue.processName,
            eventDescription: issue.eventDescription,
            count: 1,
            totalResolutionSeconds: issue.resolutionTime
          });
        }
      }

      // Get average resolution time for each top issues.
      for (let topIssue of topIssues) {
        topIssue.averageResolutionTime = Math.floor(topIssue.totalResolutionSeconds / topIssue.count);
      }

      this.setState({
        topIssues,
        last24Hours,
        last24HoursOptions,
        last7Days,
        last7DaysOptions,
        showMetrics: true,
        sumOfResolutionTimeIssues
      });
    } catch (error) {
      LOGGER.error('Error while getting metric', error);
      this.setState({ error: I18n.get('error.get.metric') });
    }
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
      showMetrics: false
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
      showMetrics: false
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
      { name: I18n.get('text.number.of.issues'), key: 'count', keyType: 'number' },
      { name: I18n.get('text.average.resolution.time'), key: 'averageResolutionTime', callFunction: convertSecondsToHms, keyType: 'number' }
    ];

    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{ I18n.get('text.metrics') }</Breadcrumb.Item>
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
          {
            this.state.showMetrics &&
            <div>
              <EmptyRow />
              <Row>
                <Col xs={12} sm={12} md={6}>
                  <Card>
                    <Card.Header>
                      <ChartistGraph data={this.state.last7Days} type="Bar" options={this.state.last7DaysOptions} />
                    </Card.Header>
                    <Card.Body>
                      <h6>{ I18n.get('text.number.of.issues.seven.days') }</h6>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                  <Card>
                    <Card.Header>
                      <ChartistGraph data={this.state.last24Hours} type="Line" options={this.state.last24HoursOptions} />
                    </Card.Header>
                    <Card.Body>
                      <h6>{ I18n.get('text.number.of.issues.three.hours') }</h6>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          }
          {
            this.state.showMetrics && this.state.sumOfResolutionTimeIssues !== '' &&
            <div>
              <EmptyRow />
              <Row>
                <Col>
                  <Card className="custom-card-big custom-card-header-danger">
                    <Card.Header><strong>{ `${I18n.get('text.total.downtime')}: ${this.state.sumOfResolutionTimeIssues}` }</strong></Card.Header>
                  </Card>
                </Col>
              </Row>
            </div>
          }
          {
            this.state.showMetrics && this.state.topIssues.length > 0 &&
            <div>
              <EmptyRow />
              <Row>
                <Col>
                  <Card className="custom-card-big custom-card-header-warning">
                    <Card.Header><strong>{ I18n.get('text.top.issues') }</strong></Card.Header>
                    <Card.Body>
                      <DataTable headers={headers} data={this.state.topIssues} initialSort={{ key: 'count', order: SortBy.Desc, keyType: 'number' }} />
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          }
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
      </div>
    );
  }
}

export default Metrics;