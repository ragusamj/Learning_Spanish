import React from 'react';
import {SERVER_ROOT} from '../config';

export default function LoginPage() {
    return (
    	<div>
	    	<div className="header">
		        <div className="blue circle"></div>
		        <div className="dark circle"></div>
		        <h1>DaVinci Language Learning</h1>
		    </div>
		    <div className="main"></div>
		    <div className="content-container">
		    	<div className="login-container">
			    	<div className="login-wrapper">
			    		<h1 className="login"> Welcome!</h1>
			    		<h3>Please log in with Google.</h3>
			    		<a href={`${SERVER_ROOT}/auth/google`} className="btn-green btn">Log In</a>
			    	</div>
			    </div>
			</div>
		    <div className="footer lgn">
		        <div className="register">
		        Don't have a Google account?<a href="" className="btn btn-black">Register</a>
		        </div>
		    </div>
	    </div>
    )
}
