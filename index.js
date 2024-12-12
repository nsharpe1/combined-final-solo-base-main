const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { error } = require('console');

const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = 'mongodb://localhost:27017/keyin_test';
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'voting-app-secret',
    resave: false,
    saveUninitialized: false,
}));
let connectedClients = [];

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
}); 

const User = mongoose.model('User', userSchema);

const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [
        {
            answer: { type: String, required: true },
            votes: { type: Number, required: true }
        }
    ]
})

const Poll = mongoose.model('Poll', pollSchema);

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);
    console.log("Connect TO Web Socket"+ socket)

    socket.on('message', async (message) => {
        const data = JSON.parse(message);
        console.log(data.type);
        switch(data.type){
            case 'votes':
                const {pollId, selectedOption} = data;
        const poll = await Poll.findOne({_id: pollId});
        let option;
        for (let i = 0; i < poll.options.length; i++) {
            if (poll.options[i].answer === selectedOption) {
                option = poll.options[i];
                break;
            }
        }
        option.votes = option.votes + 1;
        await poll.save();
                
        }
        console.log(message)
        
    });

    socket.on('close', async (message) => {
        
    });
});

app.get('/', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }

    const filter = {};
    const allpolls = await Poll.find(filter);
    const pollslength = allpolls.length;

    response.render('index/unauthenticatedIndex', {pollsnumber: pollslength});
});

app.get('/login', async (request, response) => {
    const errorMessage = request.query.error || null;
    return response.render('login', { errorMessage });
});

app.post('/login', async (request, response) => {
    const requestBody = request.body;

    const user = await User.findOne({username: requestBody.username});

    if (!user) {
        console.error("Invalid credentials");
        return response.redirect('/login?error=Invalid username');
    }
    const match = await bcrypt.compare(requestBody.password,user.password)
    if (!match) {
        console.error("Invalid credentials");
        return response.redirect('/login?error=Invalid password');
    } 
    else {
        request.session.userId = user._id;
        request.session.username = user.username;
        return response.redirect('dashboard');
    }
});

app.get('/signup', async (request, response) => {
    if (request.session.userId) {
        return response.redirect('/');
    }
    return response.render('signup', {errorMessage: null});
});

app.post("/signup", async (request, response) => {
    const { username, password } = request.body;
    const user = await User.findOne({username})
    if(user){
        return response.status(401).render('signup',{errorMessage: "This user already exist"})
    } else {
        const hashedpassword = await bcrypt.hash(password,10);
    
        const user1 = new User({ username: username, password: hashedpassword, role: "user" });
        await user1.save();
        return response.redirect('/');
    }
});

app.get('/dashboard', async (request, response) => {
    const filter = {};
    const allpolls = await Poll.find(filter);

    // console.log(JSON.stringify(allpolls));
    
    if (!request.session.userId) {
        return response.redirect('/');
    }

    //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
    // authenticatedIndex template to see how it expects polls to be represented
    return response.render('index/authenticatedIndex', { polls: allpolls });
});

app.get('/profile', async (request, response) => {
    if (!request.session.userId) {
        return response.redirect('/');
    }
    const username = request.session.username;
    return response.render('profile', {username: username});
});

app.get('/createPoll', async (request, response) => {
    if (!request.session.userId) {
        return response.redirect('/');
    }

    return response.render('createPoll')
});

// Poll creation
app.post('/createPoll', async (request, response) => {
    const { question, options } = request.body;
    const formattedOptions = Object.values(options).map((option) => ({ answer: option, votes: 0 }));

    const poll1 = new Poll({ question: question, options: formattedOptions });
    await poll1.save();
    return response.redirect('/dashboard');

    // const pollCreationError = onCreateNewPoll(question, formattedOptions);
    //TODO: If an error occurs, what should we do?
});

app.post('/logout', (request, response) => {
    request.session.destroy((error) => {
        if (error) {
            return response.status(500).send('Failed to log out.');
        }
        response.redirect('/');
    });
});

mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => console.error('MongoDB connection error:', err));

/**
 * Handles creating a new poll, based on the data provided to the server
 * 
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */
async function onCreateNewPoll(question, pollOptions) {
    let newPoll = null;
    try {
         newPoll = new Poll({
            question: question,
            options: pollOptions
        });
        await newPoll.save()
    }
    catch (error) {
        console.error(error);
        return "Error creating the poll, please try again";
    }

    sendMessagetoCilents({
       
    })
    //TODO: Tell all connected sockets that a new poll was added

    return null;
}

async function sendMessagetoCilents(pollmessage) {
    connectedClients.forEach((client) => {
        client.send(JSON.stringify(pollmessage))
    })
}
/**
 * Handles processing a new vote on a poll
 * 
 * This function isn't necessary and should be removed if it's not used, but it's left as a hint to try and help give
 * an idea of how you might want to handle incoming votes
 * 
 * @param {string} pollId The ID of the poll that was voted on
 * @param {string} selectedOption Which option the user voted for
 */
async function onNewVote(pollId, selectedOption) {
    try {
        
    }
    catch (error) {
        console.error('Error updating poll:', error);
    }
}
