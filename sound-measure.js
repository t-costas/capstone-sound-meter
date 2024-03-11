document.addEventListener('DOMContentLoaded', async function() {
    const volumeMeter = document.getElementById('volumeMeter');
    const dbLevel = document.getElementById('dbLevel');
    const avgdbLevel = document.getElementById('avgdbLevel');
    const sineGraphCtx = document.getElementById('sineGraph').getContext('2d');
    const timer = document.getElementById('timer');
    let recording = false;
    let audioChunks = [];
    let mediaRecorder;
    let stream;
    let startTime = null;
    let intervalStartTime = null;
    let intervalAudioChunks = [];
    let intervalTimer = null;
    let avgDBSum = 0;
    let avgDBCount = 0;
    let timeDBData = [];

    // Function to update volume meter, dB level, and sine graph
    const updateVolumeMeter = async () => {
        // Check if permission has already been granted
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        const audioContext = new AudioContext();
        const mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream);
        const analyserNode = audioContext.createAnalyser();
        mediaStreamAudioSourceNode.connect(analyserNode);
        analyserNode.smoothingTimeConstant = 0.8;
        
        const soundData = new Float32Array(analyserNode.fftSize);
        const onFrame = () => {
            analyserNode.getFloatTimeDomainData(soundData);
            let sumSquares = 0.0;
            for (const amplitude of soundData) { sumSquares += amplitude * amplitude; }
            volumeMeter.value = Math.sqrt(sumSquares / soundData.length); // RMS value of sound wave
            let dBReading = `${(20 * Math.log10(volumeMeter.value)).toFixed(2)}`; // Display dBFS to 2 decimal places
            dbLevel.innerText = dBReading;
            
            // Calculate average dBFS reading over the last second
            let currentTime = new Date().getTime();
            if (currentTime - intervalStartTime >= 500) {
                intervalStartTime = currentTime;
                if (avgDBCount > 0) {
                    avgdbLevel.innerText = `${(avgDBSum / avgDBCount).toFixed(2)}`;
                } else {
                    avgdbLevel.innerText = "No data";
                }
                avgDBSum = 0; // Reset average dB sum
                avgDBCount = 0; // Reset average dB count
            }
            avgDBSum += parseFloat(dbLevel.innerText);
            avgDBCount++;

            // Store time vs dB data for plotting
            if (recording) {
                const time = new Date().getTime() - startTime;
                timeDBData.push([time / 1000, parseFloat(dbLevel.innerText)]); // Convert milliseconds to seconds
            }

            // Clear canvas
            sineGraphCtx.clearRect(0, 0, sineGraphCtx.canvas.width, sineGraphCtx.canvas.height);
        
            // Draw sine graph
            sineGraphCtx.beginPath();
            sineGraphCtx.strokeStyle = '#000';
            sineGraphCtx.lineWidth = 2;
            sineGraphCtx.moveTo(0, sineGraphCtx.canvas.height / 2);
            for (let i = 0; i < soundData.length; i++) {
              const x = i / soundData.length * sineGraphCtx.canvas.width;
              const y = (soundData[i] + 1) / 2 * sineGraphCtx.canvas.height;
              sineGraphCtx.lineTo(x, y);
            }
            sineGraphCtx.stroke();
        
            window.requestAnimationFrame(onFrame);
          };
          window.requestAnimationFrame(onFrame);
        };

    // Function to start recording
    const startRecording = () => {
        recording = true;
        audioChunks = [];
        startTime = new Date().getTime(); // Reset the start time
        intervalStartTime = new Date().getTime(); // Reset interval start time
        intervalAudioChunks = []; // Clear interval audio chunks
        avgDBSum = 0; // Reset average dB sum
        avgDBCount = 0; // Reset average dB count
        timeDBData = []; // Clear time vs dB data
        updateVolumeMeter();
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        mediaRecorder.ondataavailable = e => {
            audioChunks.push(e.data);
            intervalAudioChunks.push([new Date().getTime(), parseFloat(dbLevel.innerText) || 0]); // Store timestamp and dBFS reading
        };
        mediaRecorder.onstop = () => {
            let audioBlob = new Blob(audioChunks);
            let audioUrl = URL.createObjectURL(audioBlob);
            let audio = new Audio(audioUrl);
            audio.play();
            let csvContent = "Time (s),Relative Sound Level (dBFS)\n";
            for (const [time, dB] of timeDBData) {
                csvContent += `${time},${dB}\n`;
            }
            let csvData = new Blob([csvContent], { type: 'text/csv' });
            let currentDate = new Date().toISOString().split('T')[0]; // Get today's date in the format YYYY-MM-DD
            let csvUrl = URL.createObjectURL(csvData);
            let csvLink = document.createElement('a');
            csvLink.href = csvUrl;
            csvLink.download = `sound_data_${currentDate}.csv`;
            csvLink.click();
        };
        // Update timer continuously while recording
        intervalTimer = setInterval(() => {
            const elapsedTime = new Date().getTime() - startTime;
            const minutes = Math.floor(elapsedTime / (1000 * 60));
            const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
            timer.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
        document.getElementById('recordingIndicator').style.display = 'block';
    };
        
    document.getElementById('startButton').addEventListener('click', startRecording);
        
    document.getElementById('stopButton').addEventListener('click', () => {
        recording = false;
        clearInterval(intervalTimer);
        document.getElementById('recordingIndicator').style.display = 'none';
        mediaRecorder.stop();
    });

        
    updateVolumeMeter();
});
