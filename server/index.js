const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();

const { User, Questions } = require('./models');

const HOST = process.env.HOST;
const PORT = process.env.PORT || 8080;


const config = require('./config');
const secret = require('./secret');

const app = express();
app.use(cookieParser());
mongoose.Promise = global.Promise;


app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', config.CLIENT_ROOT);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(passport.initialize());

passport.use(
    new GoogleStrategy({
        clientID:  '586076467304-6uua98ggril15fvn69ge4pbl04c2uhkq.apps.googleusercontent.com',
        clientSecret: secret,
        callbackURL: `${config.ROOT}/auth/google/callback`
    },
    (accessToken, refreshToken, profile, cb) => {
        User.findOne({ googleId: profile.id })
            // .exec()
            .then(user => {
                console.log("profile.id and accessToken", profile.id, accessToken);
                if (!user) {
                    console.log("testing create");
                    return User.create({
                        name: profile.displayName,
                        googleId: profile.id,
                        accessToken: accessToken,
                        correctCount: 0,
                        questionCount: 0

                        
                    })
                } 
                return user;     
            })
            .then(user => {
                console.log('will user be array or obj? ', user);
                if( accessToken !== user.accessToken) {
                    return User
                        .findByIdAndUpdate(user._id, {$set: {accessToken:accessToken}}, {new: true})
                        .exec()
                }
                return user;

            })
            .then(user => {
                console.log("USER", user);
                return cb(null, user);
            })
            .catch(err => {
                console.log(err);
            })   
    }
));

passport.use(
    new BearerStrategy(
        (token, done) => {
            console.log("TOKEN IS HERE",token);
            console.log("DONE");
            User.find({accessToken: token}, function(err, user){
                console.log('Token from OAuth',token);
                if(!user.length){
                    console.log("SEARCH FAILED");
                    return done(null, false);
                }
                else {
                    console.log("SEARCH SUCCEEDED");
                    return done(null, User.findOne({ 'accessToken': token }));
            }
            })
            
        }
    )
);

app.get('/auth/google',
    passport.authenticate('google', {scope: ['profile']}));

app.get('/auth/google/callback',
    passport.authenticate('google', {
        // failureRedirect: `${config.CLIENT_ROOT}`,
        failureRedirect: '/login',
        session: false
    }),
    (req, res) => {
        res.cookie('accessToken', req.user.accessToken, {expires: 0});
        res.redirect(`${config.CLIENT_ROOT}`);
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout();
    res.clearCookie('accessToken');
    res.redirect(`${config.CLIENT_ROOT}`);
});

app.get('/api/me',
    passport.authenticate('bearer', {session: false}),
    (req, res) => res.json({

        googleId: req.user.googleId
    })
);

app.get('/api/questions',
    passport.authenticate('bearer', {session: false}),
    (req, res) => res.json(['Question 1', 'Question 2'])
);

app.post('/loadspanishquestions', passport.authenticate('bearer', {session: false}), (req, res) => {
    let cookie = req.user._conditions.accessToken;
    Questions.find({})
    .exec()
    .then(questions => {
        console.log("Questions", questions);
        console.log("Cookie", cookie);
        User.findOneAndUpdate({accessToken: cookie}, {$set:{questionsArray: questions}}, {new: true})  
        .exec()
        .then(_res => {
        //     let firstQuestion = _res.questionsArray[0];
        console.log("RES?", _res);
        return res.status(202).json(_res);
        })
    
    })
});

app.get('/firstquestion', passport.authenticate('bearer', {session: false}), (req, res) => {
    console.log('req.user', req.user._conditions.accessToken);
    let cookie = req.user._conditions.accessToken;
    console.log("Correct Cookie?", cookie);
    User
        .findOne({accessToken: cookie})
        .exec()
        .then(user => {
            console.log("User response:",  user);
            let currentQuestion = user.questionsArray[0];
            let response = {
                currentQuestion: currentQuestion,
                correctCount: user.correctCount,
                questionCount: user.questionCount
            }
            // console.log("currentQuestion", currentQuestion);
            res.json(response);
        })
        .catch(err => {
            console.log("ERROR", err);
        })     
});

app.post('/nextquestion/:answer', passport.authenticate('bearer', {session: false}), (req, res) => {

    // let answer = req.body.answer;
    let cookie = req.user._conditions.accessToken;
    let temp = req.params.answer;
    let answerGiven = parseInt(temp.substr(1));
    console.log("answer before parseInt?", temp);

    User.findOne({accessToken: cookie})
    .exec()
    .then(user => {
        // console.log("user on backend", user);
        user.questionCount++;
        let currentQuestion = user.questionsArray[0];
        console.log("answer given typeof ", typeof(answerGiven));
        console.log("correct answer type of", typeof(currentQuestion.answer));
        console.log("boolean test", (answerGiven !== currentQuestion.answer));

        // Algorithm

        if (answerGiven !== currentQuestion.answer) {
            console.log('wrong answer');
            if(currentQuestion.m > 1) {
                currentQuestion.m = Math.floor(currentQuestion.m / 2);
            }
        } else {
            console.log('correct answer');
            user.correctCount++;
            currentQuestion.m = currentQuestion.m * 2;
            if (currentQuestion.m > user.questionsArray.length) {
                currentQuestion.m = user.questionsArray.length - 1;
            }
        }
        user.questionsArray.splice(0, 1);
        user.questionsArray.splice(currentQuestion.m, 0, currentQuestion);
        // console.log("user.questionsArray should update", user.questionsArray);

        user.save(function(err) {
            if (err) {
                throw err;
            } else {
                res.status(202).json({correctCount: user.correctCount, questionCount:
                user.questionCount, nextQuestion: user.questionsArray[0]});
            }
        })



        // console.log("user.questionsArray should be different ", newQArray);
        // let questionsArray = user.questionsArray;
        // let currentQuestion = questionsArray[0];
        // console.log("questionsArray[0]", currentQuestion);
        // console.log("M value visible?", currentQuestion.m);
        // console.log("still see answer? ", answer);

        // // Algorithm

        // if (answer !== currentQuestion.answer) {
        //     console.log('wrong answer');
        //     if(currentQuestion.m > 1) {
        //         currentQuestion.m = Math.floor(currentQuestion.m / 2);
        //     }
        // } else {
        //     console.log('correct answer');
        //     // correctCount++;
        //     currentQuestion.m = currentQuestion.m * 2;
        //     if (currentQuestion.m > questionsArray.length) {
        //         currentQuestion.m = questionsArray.length - 1;
        //     }
        // }
        // questionsArray.splice(0, 1);
        // console.log("questionsArray[0] should update", questionsArray[0])
        // console.log('currentQuestion.m', currentQuestion.m);
        // questionsArray.splice(currentQuestion.m, 0, currentQuestion);
        // // console.log("questionsArray should be different ", newQArray);

        // return questionsArray;
    })
    // .then(_res => {

    //     console.log("did Q array return? ", _res);
    //     res.status(202).json(_res[0]);
    // })
    .catch(err => {
                console.log(err);
    }) 
})
// 3 JOBS REMAINING
//  1) update Users.questionsArray in database
//  2) Track and update question count in database, 
//      (return to front end in same function or have front end have action for it)
//  3) same as #2 except with question count




let server;
function runServer() {
    return new Promise((resolve, reject) => {
        mongoose.connect('mongodb://user1:user1@ds143900.mlab.com:43900/spaced_rep', function(err){
        if(err) {
            return reject(err);
        }
        app.listen(PORT, HOST, (err) => {
        if (err) {
            console.error(err);
            reject(err);
        }
        const host = HOST || 'localhost';
        console.log(`Listening on ${host}:${PORT}`);
     });
   });
        
    });
}

function closeServer() {
    return new Promise((resolve, reject) => {
        server.close(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

if (require.main === module) {
    runServer(config.HOST, config.PORT);
}

module.exports = {
    app, runServer, closeServer
};
