// Establish a WebSocket connection to the server
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    // console.log(data + "14");
    if(data.type === 'pollUpdate') {
        updatePollUI(data.poll);
    }
}

function updatePollUI(updatedPoll) {
    const pollContainer = document.getElementById(updatedPoll._id);
    if (pollContainer) {
        const optionsList = pollContainer.querySelector('.poll-options');
        optionsList.innerHTML = ''; // Clear current options
 
        // Re-render updated options
        updatedPoll.options.forEach((option) => {
            const li = document.createElement('li');
            li.id = `${updatedPoll._id}_${option.answer}`;
            li.innerHTML = `<strong>${option.answer}:</strong> ${option.votes} votes`;
            optionsList.appendChild(li);
        });
    }
}

document.querySelectorAll('.vote-button').forEach((button) => {
    button.addEventListener('click', (event) => {
        event.preventDefault();
 
        const pollId = event.target.form['poll-id'].value;
        const selectedOption = event.target.value;
 
        socket.send(JSON.stringify({ type: 'vote', pollId, selectedOption }));
    });
});

/**
 * Handles adding a new poll to the page when one is received from the server
 * 
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
    //TODO: Fix this to add the new poll to the page
    
    const pollContainer = document.getElementById('polls');
    const newPoll = null;
    pollContainer.appendChild(newPoll);

    //TODO: Add event listeners to each vote button. This code might not work, it depends how you structure your polls on the poll page. However, it's left as an example 
    //      as to what you might want to do to get clicking the vote options to actually communicate with the server
    newPoll.querySelectorAll('.poll-form').forEach((pollForm) => {
        pollForm.addEventListener('submit', onVoteClicked);
    });
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 * 
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {

}

/**
 * Handles processing a user's vote when they click on an option to vote
 * 
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
    console.log("Vote clicked!")
    //Note: This function only works if your structure for displaying polls on the page hasn't changed from the template. If you change the template, you'll likely need to change this too
    event.preventDefault();
    const formData = new FormData(event.target);

    const pollId = formData.get("poll-id");
    const selectedOption = event.submitter.value;

    const pollInput = document.getElementById('poll');
    socket.send(
        JSON.stringify(
            { type: "votes", pollId: pollId, selectedOption: selectedOption }
        )
    );
    
    //TOOD: Tell the server the user voted
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll('.poll-form').forEach((pollForm) => {
    pollForm.addEventListener('submit', onVoteClicked);
});