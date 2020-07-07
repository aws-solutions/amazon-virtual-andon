
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

// Import React Bootstrap components
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Table from 'react-bootstrap/Table';
import Pagination from 'react-bootstrap/Pagination';

// Import custom setting
import { SortBy } from './Enums';
import { getLocaleString, sortByName } from '../util/CustomUtil';
import EmptyCol from '../components/EmptyCol';
import * as uuid from 'uuid';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  // Table headers
  headers: { name: string, key: string, callFunction?: Function, keyType?: string }[];
  // Data
  data: any[];
  // Initial number of items to show in a page
  initialPageLength?: 10 | 25 | 50 | 100;
  // Initial sort key and order
  initialSort?: { key: string, order: SortBy, keyType?: string };
  // Data version from the source
  dataVersion?: number
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  // Table headers
  headers: { name: string, key: string, callFunction?: Function, keyType?: string }[];
  // Data to show in the table
  data: any[];
  // Number of items to show in a page
  pageSize: number;
  // Current page to show the items
  currentPage: number;
  // Last page of the table
  lastPage: number;
  // Sort key and order
  sort: { key: string, order: SortBy, keyType?: string };
  // Data version
  dataVersion?: number
}

/**
 * The class returns data table with the given data.
 * @class DataTable
 */
class DataTable extends React.Component<IProps, IState> {
  // The first page
  private FIRST_PAGE: number;
  // The maximum pagination items
  private MAX_PAGINATION_ITEMS: number;
  // The middle pagination buffer
  private MIDDLE_PAGINATION_BUFFER: number;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      headers: this.props.headers,
      data: this.props.data,
      pageSize: this.props.initialPageLength ? this.props.initialPageLength : 10,
      currentPage: 1,
      lastPage: 1,
      sort: this.props.initialSort ? this.props.initialSort : { key: '', order: SortBy.Asc },
      dataVersion: this.props.dataVersion ? this.props.dataVersion : undefined
    }

    // The first page is 1.
    this.FIRST_PAGE = 1;
    // By default, the maximum pagination items are 5.
    this.MAX_PAGINATION_ITEMS = 5;
    // If the current page is in the middle, pagination shows the number of buffers for previous and next pages.
    this.MIDDLE_PAGINATION_BUFFER = Math.floor(this.MAX_PAGINATION_ITEMS / 2);

    this.getLastPage = this.getLastPage.bind(this);
    this.setCurrentPage = this.setCurrentPage.bind(this);
    this.handlePageSizeChange = this.handlePageSizeChange.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  componentDidMount() {
    // Initially all data is going to be shown.
    const { headers, data, sort } = this.state;

    // Set all data visible.
    for (let datum of data) {
      datum.visible = true;
    }

    // If sort key is not provided, first header key becomes the inital sort key.
    if (sort.key === '' && headers.length > 0) {
      sort.key = headers[0].key;
      sort.keyType = headers[0].keyType;
    }

    // Set state with the initially sorted data.
    this.setState({
      data: sortByName(data, sort.order, sort.key, sort.keyType),
      lastPage: this.getLastPage(),
      sort
    });
  }

  /**
   * React getDerivedStateFromProps function
   * If there's data change from the parent, it changes the data to re-render.
   * @param {IPros} props - New props
   * @param {IState} state - Current state
   */
  static getDerivedStateFromProps(props: IProps, state: IState) {
    if (props.dataVersion !== state.dataVersion) {
      const element = document.getElementById('searchKeyword') as HTMLInputElement;
      const searchKeyword = element ? element.value : '';

      // Set visibility for new data.
      for (let datum of props.data) {
        datum.visible = false;

        if (searchKeyword === '') {
          datum.visible = true;
        } else {
          for (let header of props.headers) {
            const value = datum[header.key];
            if (`${value}`.includes(searchKeyword)) {
              datum.visible = true;
              break;
            }
          }
        }
      }

      // Get last page.
      const pageSize = state.pageSize;
      const dataLength = props.data.filter(datum => datum.visible).length;
      let lastPage = Math.floor(dataLength / pageSize);

      if (dataLength % pageSize > 0) {
        lastPage++;
      }

      return {
        data: sortByName(props.data, state.sort.order, state.sort.key, state.sort.keyType),
        lastPage,
        dataVersion: props.dataVersion
      };
    }

    return null;
  }

  /**
   * Get last page.
   * @param {number | undefined} newPageSize - New page size
   * @return {number} The last page number
   */
  getLastPage(newPageSize?: number): number {
    const { data } = this.state;
    const pageSize = newPageSize ? newPageSize : this.state.pageSize;
    const dataLength = data.filter(datum => datum.visible).length;
    let lastPage = Math.floor(dataLength / pageSize);

    if (dataLength % pageSize > 0) {
      lastPage++;
    }

    return lastPage;
  }

  /**
   * Get pagination components.
   * The default maximum pages to show at pagination is 5.
   * When there are more than 5 pages data, pagination will only show 5 pagination pages.
   * @return {JSX.Element[]} Pagination components
   */
  getPagination(): JSX.Element[] {
    const { currentPage, lastPage } = this.state;
    const pagination: JSX.Element[] = [];

    /**
     * 1) If there's no data, it returns only disabled page 1.
     * 2) If the last page is equal to or less than the number of maximum pagination items, it shows every pagination items.
     * 3) If the pages are more than the number of maximum pagination items, it caculates which pages to show.
     */
    if (lastPage === 0) {
      pagination.push(
        <Pagination.Item key="no-data" disabled>{1}</Pagination.Item>
      );
    } else if (lastPage <= this.MAX_PAGINATION_ITEMS) {
      for (let page = 1; page <= lastPage; page++) {
        pagination.push(
          <Pagination.Item key={`page-${page}`} active={currentPage === page} onClick={() => this.setCurrentPage(page)}>{page}</Pagination.Item>
        )
      }
    } else {
      // How many pages are between the the first page and the current page.
      let fromCurrent = currentPage - this.FIRST_PAGE;
      // How many pages are between the the last page and the current page.
      let fromLast = lastPage - currentPage;
      // First page number to show in the pagination.
      let firstShowPage = this.FIRST_PAGE;
      // Last page number to show in the pagination.
      let lastShowPage = lastPage;

      /**
       * 1) If the number of pages between the first page and the current page is less than buffer, the last page number to show is the number of the maximium pagination items.
       * 2) If the number of pages between the first/last page and the current page is somewhat in the middle of pagination, the current page goes in the middle.
       * 3) If there are not enough pages between the last page and the current page, the last page number to show is the last page.
       */
      if (fromCurrent <= this.MIDDLE_PAGINATION_BUFFER) {
        lastShowPage = this.MAX_PAGINATION_ITEMS;
      } else if (fromCurrent > this.MIDDLE_PAGINATION_BUFFER && fromLast > this.MIDDLE_PAGINATION_BUFFER) {
        firstShowPage = currentPage - this.MIDDLE_PAGINATION_BUFFER;
        lastShowPage = currentPage + this.MIDDLE_PAGINATION_BUFFER;
      } else if (fromLast <= this.MIDDLE_PAGINATION_BUFFER) {
        firstShowPage = lastPage - this.MAX_PAGINATION_ITEMS - 1;
        lastShowPage = lastPage;
      }

      for (let page = firstShowPage; page <= lastShowPage; page++) {
        pagination.push(
          <Pagination.Item key={`page-${page}`} active={currentPage === page} onClick={() => this.setCurrentPage(page)}>{page}</Pagination.Item>
        )
      }
    }

    return pagination;
  }

  /**
   * Set current page.
   * @param {number} page - New current page
   */
  setCurrentPage(page: number) {
    this.setState({ currentPage: page });
  }

  /**
   * Handle the page size select change.
   * @param {any} event - Event from page size select
   */
  handlePageSizeChange(event: any) {
    const pageSize = event.target.value;

    // When the page size is changed, it goes to the first page.
    this.setState({
      pageSize: parseInt(pageSize),
      lastPage: this.getLastPage(pageSize),
      currentPage: 1
    });
  }

  /**
   * Handle the search keyword change to filter the data result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { data, headers } = this.state;

    /**
     * When search keyword is empty, show every data.
     * When search keyword is not empty, find every data which contains search keyword.
     */
    for (let datum of data) {
      datum.visible = false;

      if (searchKeyword === '') {
        datum.visible = true;
      } else {
        for (let header of headers) {
          const value = datum[header.key];
          if (`${value}`.toLowerCase().includes(searchKeyword.toLowerCase())) {
            datum.visible = true;
            break;
          }
        }
      }
    }

    // When the search keyword is changed, it goes to the first page.
    this.setState({
      currentPage: 1,
      lastPage: this.getLastPage(),
      data
    });
  }

  /**
   * Sort the data table by key.
   * @param {string} key - Key to sort
   * @param {string | undefined} type - Key type
   */
  handleSort(key: string, keyType?: string) {
    const { sort, data } = this.state;

    // If key is same, change the order. If the key is different, set the new key, and change order to ascending.
    if (sort.key === key) {
      sort.order = sort.order === SortBy.Asc ? SortBy.Desc : SortBy.Asc;
    } else {
      sort.key = key;
      sort.order = SortBy.Asc;
      sort.keyType = keyType;
    }

    // When the sort key or order is changed, it goes to the first page.
    this.setState({
      data: sortByName(data, sort.order, sort.key, keyType),
      currentPage: 1,
      sort
    });
  }

  /**
   * Render this page.
   */
  render() {
    const { headers, data, sort, currentPage, pageSize } = this.state;
    const startIndex = currentPage * pageSize - pageSize;
    const endIndex = currentPage * pageSize;

    return (
      <div>
        <Row>
          <Col>
            <Form>
              <Form.Row className="justify-content-between">
                <Col md={3}>
                  <Form.Group as={Row} controlId="showCountId">
                    <Form.Label column sm={6}>
                      { getLocaleString('Page Size') }
                    </Form.Label>
                    <Col sm={6}>
                      <Form.Control as="select" defaultValue={pageSize} onChange={this.handlePageSizeChange}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </Form.Control>
                    </Col>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Control id="searchKeyword" placeholder={ getLocaleString('Search Keyword') } onChange={this.handleSearchKeywordChange} />
                </Col>
              </Form.Row>
            </Form>
          </Col>
        </Row>
        <Row>
          <Col>
          {
            headers.length === 0 &&
            <Jumbotron>
              <p>{ getLocaleString('No header found DataTable.') }</p>
            </Jumbotron>
          }
          {
            headers.length > 0 &&
            <div>
              <Form.Text>
                <span className="required-field">*</span>
                <EmptyCol />
                <strong>{ getLocaleString('Sort By') }</strong>:
                <EmptyCol />
                { headers.filter(header => header.key === sort.key).length > 0 ? headers.filter(header => header.key === sort.key)[0].name : 'N/A' },
                <EmptyCol />
                <strong>{ getLocaleString('Order') }</strong>:
                <EmptyCol />
                { sort.order === SortBy.Asc ? getLocaleString('Ascending') : getLocaleString('Descending') } -
                <EmptyCol />
                { getLocaleString('Click each column header to change the data sort.')}
              </Form.Text>
              <Table striped bordered>
                <thead>
                  <tr>
                  {
                    headers.map(header => {
                      return (
                        <th key={`thead-${header.key}`} onClick={() => this.handleSort(header.key, header.keyType)}>{header.name}</th>
                      );
                    })
                  }
                  </tr>
                </thead>
                <tbody>
                {
                  data.filter(datum => datum.visible).slice(startIndex, endIndex).length === 0 &&
                  <tr>
                    <td colSpan={headers.length}>{ getLocaleString('No data') }</td>
                  </tr>
                }
                {
                  data.filter(datum => datum.visible).slice(startIndex, endIndex).map(datum => {
                    return (
                      <tr key={uuid.v4()}>
                      {
                        headers.map(header => {
                          const key = header.key;
                          const value = datum[key] ? datum[key] : '';

                          return (
                            <td key={`tbody-${key}`}>{ header.callFunction ? header.callFunction(value) : value }</td>
                          );
                        })
                      }
                      </tr>
                    )
                  })
                }
                </tbody>
                <tfoot>
                  <tr>
                  {
                    headers.map(header => {
                      return (
                        <th key={`tfoot-${header.key}`} onClick={() => this.handleSort(header.key, header.keyType)}>{header.name}</th>
                      );
                    })
                  }
                  </tr>
                </tfoot>
              </Table>
            </div>
          }
          </Col>
        </Row>
        {
          headers.length > 0 &&
          <Row>
            <Col>
              <Form.Row className="justify-content-md-center">
                <Pagination>
                  <Pagination.First disabled={this.state.currentPage === 1} onClick={() => this.setCurrentPage(1)} />
                  <Pagination.Prev disabled={this.state.currentPage === 1} onClick={() => this.setCurrentPage(this.state.currentPage - 1)} />
                  { this.getPagination () }
                  <Pagination.Next disabled={this.state.lastPage <= this.state.currentPage} onClick={() => this.setCurrentPage(this.state.currentPage + 1)} />
                  <Pagination.Last disabled={this.state.lastPage <= this.state.currentPage} onClick={() => this.setCurrentPage(this.state.lastPage)} />
                </Pagination>
              </Form.Row>
            </Col>
          </Row>
        }
      </div>
    )
  }
}

export default DataTable;