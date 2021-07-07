// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';

// Import React Bootstrap components
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

// Import EmptyCol
import EmptyCol from './EmptyCol';

/**
 * The class returns an empty row.
 * @class EmptyRow
 */
class EmptyRow extends React.Component {
  /**
   * Render the page
   */
  render() {
    return (
      <Row>
        <Col>
          <EmptyCol />
        </Col>
      </Row>
    );
  }
}

export default EmptyRow;