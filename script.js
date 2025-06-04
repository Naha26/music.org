
const SUPABASE_URL = 'https://eamqphykswssydupflow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbXFwaHlrc3dzc3lkdXBmbG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5Mzg2NDQsImV4cCI6MjA2NDUxNDY0NH0.l4Yh_Iug43eBG7rD2VcVA6iYKZI7kcEpRMSOe0JtFw0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const uploadForm = document.getElementById('upload-form');
const mixesContainer = document.getElementById('mixes-container');
const musicPlayer = document.getElementById('music-player');
const downloadButton = document.getElementById('download-button');
const searchInput = document.getElementById('search-input');

let currentMixUrl = null;
let currentMixName = null;

// Function to fetch mixes from Supabase
async function fetchMixes() {
    try {
        const { data, error } = await supabase
            .from('mixes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching mixes:', error);
            return;
        }

        displayMixes(data);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Function to display mixes
function displayMixes(mixes) {
    mixesContainer.innerHTML = ''; // Clear existing content

    mixes.forEach(mix => {
        const mixCard = document.createElement('div');
        mixCard.classList.add('mix-card');

        mixCard.innerHTML = `
            <h3>${mix.dj_name} - ${mix.description}</h3>
            <p>Location: ${mix.location}</p>
            <button onclick="playMix('${mix.audio_url}', '${mix.dj_name} - ${mix.description}')">Play</button>
        `;

        mixesContainer.appendChild(mixCard);
    });
}

// Function to play a mix
function playMix(audioUrl, mixName) {
    musicPlayer.src = audioUrl;
    musicPlayer.play();
    currentMixUrl = audioUrl;
    currentMixName = mixName || 'mix';
    downloadButton.style.display = 'inline-block';
}

// Event listener for download button
downloadButton.addEventListener('click', function() {
    if (currentMixUrl) {
        downloadFile(currentMixUrl, currentMixName);
    }
});

// Function to download a file
function downloadFile(fileUrl, fileName) {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName || fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Function to search mixes
async function searchMixes() {
    const searchTerm = searchInput.value.toLowerCase();

    try {
        const { data, error } = await supabase
            .from('mixes')
            .select('*')
            .or(`dj_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

        if (error) {
            console.error('Error searching mixes:', error);
            return;
        }

        displayMixes(data);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Upload Form Submission
uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const djName = document.getElementById('dj-name').value;
    const description = document.getElementById('description').value;
    const location = document.getElementById('location').value;
    const audioFile = document.getElementById('audio-file').files[0];

    if (!audioFile) {
        alert('Please select an audio file.');
        return;
    }

    // Check file size (limit to 50MB)
    if (audioFile.size > 50 * 1024 * 1024) {
        alert('File size too large. Maximum size is 50MB.');
        return;
    }

    try {
        // Generate unique filename
        const fileExt = audioFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        // Upload the file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('music')
            .upload(filePath, audioFile);

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            alert('Error uploading file: ' + uploadError.message);
            return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('music')
            .getPublicUrl(filePath);

        // Insert metadata into Supabase Database
        const { error: dbError } = await supabase
            .from('mixes')
            .insert([
                {
                    dj_name: djName,
                    description: description,
                    location: location,
                    audio_url: urlData.publicUrl,
                    file_path: filePath
                }
            ]);

        if (dbError) {
            console.error('Error inserting data:', dbError);
            alert('Error saving mix details: ' + dbError.message);

            // Delete the uploaded file if database insertion fails
            await supabase.storage.from('music').remove([filePath]);
            return;
        }

        alert('Mix uploaded successfully!');
        uploadForm.reset();

        // Refresh the mixes display
        fetchMixes();

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        alert('An unexpected error occurred. Please try again.');
    }
});

// Initial fetch of mixes when the page loads
document.addEventListener('DOMContentLoaded', fetchMixes);