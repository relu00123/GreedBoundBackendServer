
export class JobQueue 
{
    private queue : (() => Promise<void>)[] = [];
    private isRunning = false;

    execute(job: () => Promise<void>) {
        this.queue.push(job);
        if(!this.isRunning) this.runNext();
    }

    private async runNext() {
        this.isRunning = true;
        while(this.queue.length > 0) {
            const job = this.queue.shift();
            try {
                if (job) await job();
            } catch (err) {
                console.error("[JobQueue Error]:", err);
            }
        }
        this.isRunning = false;
    }

}