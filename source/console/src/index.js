import React from "react";
import ReactDOM from "react-dom";

import { BrowserRouter, Route, Switch } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/animate.min.css";
import "./assets/sass/light-bootstrap-dashboard-react.scss?v=1.3.0";
import "./assets/css/demo.css";
import "./assets/css/pe-icon-7-stroke.css";
import { SignUp } from "aws-amplify-react";
import AdminLayout from "layouts/Admin.jsx";

const map = (message) => {
  if (/incorrect.*username.*password/i.test(message)) {
    return 'Incorrect username or password';
  }
  if (/user.*not.*exist/i.test(message)) {
    return 'Incorrect username or password';
  }

  return message;
}

ReactDOM.render(
  <BrowserRouter>
    <Switch>
      <Route path="/" render={props => <AdminLayout {...props} hide={[SignUp]} errorMessage={map} />} />
    </Switch>
  </BrowserRouter>,
  document.getElementById("root")
);
