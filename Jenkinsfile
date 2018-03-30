pipeline {
    agent none
    environment {
        CI = 'true'
    }
    stages {
        stage('Build') {
            agent {
                docker {
                    image 'node'
                    args '-p 3000:3000'
                }
            }
            steps {
                sh 'npm install'
            }
        }
        stage('Deliver') {
            agent {
                docker {
                    image 'node'
                    args '-p 3000:3000'
                }
            }
            steps {
                sh './jenkins/scripts/deliver.sh'
            }
        }
        stage('Build and Publish Docker Image') {
            agent {
                docker {
                    image 'docker:edge'
                    args '--entrypoint=""'
                }
            }
            steps {
                script {
                    docker.withRegistry('http://localhost:5000') {
                        docker.build("mt-connector-agent:${env.BUILD_TAG}").push('latest')
                    }
                }
            }
        }
    }
    post {
        always {
            echo "One way or another, I have finished the pipeline: ${currentBuild.fullDisplayName} - ${env.BUILD_URL}"
        }
        success {
            echo 'I succeeeded!'
        }
        unstable {
            echo 'I am unstable :/'
        }
        failure {
            echo 'I failed :('
        }
        changed {
            echo 'Things were different before...'
        }
    }
}
